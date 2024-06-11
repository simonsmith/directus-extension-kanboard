import {computed, ref, toRefs, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import {
  defineLayout,
  useCollection,
  useFilterFields,
  useItems,
  useSync,
  useStores,
  useApi,
} from '@directus/extensions-sdk'
import {getEndpoint, getRelationType, moveInArray} from '@directus/utils'
import {translate} from '../shared/utils/translate-literal'
import LayoutComponent from './layout.vue'
import Options from './options.vue'
import enUS from '../lang/en-US.yaml'

export default defineLayout({
  id: 'cdh-kanboard',
  name: 'Kanboard',
  icon: 'view_kanban',
  component: LayoutComponent,
  slots: {
    options: Options,
    sidebar: () => null,
    actions: null,
  },
  setup(props, {emit}) {
    const {t, mergeLocaleMessage} = useI18n()

    mergeLocaleMessage('en-US', enUS)
    const api = useApi()

    const {useFieldsStore, useRelationsStore, useServerStore} = useStores()
    const fieldsStore = useFieldsStore()
    const relationsStore = useRelationsStore()
    const {info: serverInfo} = useServerStore()

    const layoutOptions = useSync(props, 'layoutOptions', emit)
    const layoutQuery = useSync(props, 'layoutQuery', emit)

    const {collection} = toRefs(props)

    const {
      info,
      primaryKeyField,
      fields: fieldsInCollection,
      sortField,
    } = useCollection(collection)

    const {sort, limit, page, fields} = useLayoutQuery()

    const {fieldGroups} = useFilterFields(fieldsInCollection, {
      title: (field) => field.type === 'string' || field.type === 'text',
      text: (field) => field.type === 'string' || field.type === 'text',
      tags: (field) => field.type === 'json' || field.type === 'csv',
      date: (field) =>
        ['date', 'time', 'dateTime', 'timestamp'].includes(field.type),
      user: (field) => {
        const junction = relationsStore.relations.find((relation) => {
          return (
            relation.meta?.one_collection === props.collection &&
            relation.meta.one_field === field.field &&
            relation.meta.junction_field !== null
          )
        })

        if (junction !== undefined) {
          const related = relationsStore.relations.find(
            (relation) =>
              relation.collection === junction.collection &&
              relation.field === junction.meta?.junction_field &&
              relation.related_collection === 'anythink_users',
          )
          return related !== undefined
        } else {
          const related = relationsStore.relations.find(
            (relation) =>
              relation.collection === props.collection &&
              relation.field === field.field &&
              relation.related_collection === 'anythink_users',
          )

          return related !== undefined
        }
      },
      group: (field) => {
        if (
          field.meta?.options &&
          Object.keys(field.meta.options).includes('choices') &&
          ['string', 'integer', 'float', 'bigInteger'].includes(field.type)
        ) {
          return Object.keys(field.meta.options).includes('choices')
        }

        const relation = relationsStore.relations.find(
          (relation) =>
            getRelationType({
              relation,
              collection: collection.value,
              field: field.field,
            }) === 'm2o',
        )

        return !!relation
      },

      file: (field) => {
        if (field.field === '$thumbnail') return true

        const relation = relationsStore.relations.find((relation) => {
          return (
            relation.collection === props.collection &&
            relation.field === field.field &&
            relation.related_collection === 'directus_files'
          )
        })

        return !!relation
      },
    })

    const {
      groupField,
      groupTitle,
      imageSource,
      titleField,
      textField,
      crop,
      selectedGroup,
      dateField,
      tagsField,
      userField,
      showUngrouped,
      showIndex,
      enableInfiniteScroll,
      userFieldJunction,
      userFieldType,
    } = useLayoutOptions()

    const {
      groups,
      groupsSortField,
      groupsPrimaryKeyField,
      groupTitleFields,
      groupsCollection,
      changeGroupSort,
      addGroup,
      editGroup,
      deleteGroup,
      isRelational,
    } = useGrouping()

    const groupedItems = computed<Group[]>(() => {
      const groupsCollectionPrimaryKeyField = groupsPrimaryKeyField.value?.field
      const groupTitleField =
        groupTitle?.value || groupsCollectionPrimaryKeyField

      const group = groupField.value
      const pkField = primaryKeyField.value?.field
      const itemGroups: Record<string | number, Group> = {}

      if (!pkField || !group) return []

      if (isRelational.value && !groupTitleField) return []

      groups.value.forEach((group, index) => {
        const id =
          isRelational.value && groupsCollectionPrimaryKeyField
            ? group[groupsCollectionPrimaryKeyField]
            : group.value

        const title = String(
          isRelational.value && groupTitleField
            ? group[groupTitleField]
            : group.text,
        )

        itemGroups[id] = {
          id,
          title: translate(title, t),
          sort: index,
        }
      })

      if (showUngrouped.value) {
        itemGroups['_ungrouped'] = {
          id: null,
          title: '_ungrouped',
          sort: -1,
        }
      }

      return Object.values(itemGroups).sort((a, b) => a.sort - b.sort)
    })

    function useLayoutOptions() {
      const groupField = createViewOption<string | null>(
        'groupField',
        fieldGroups.value.group[0]?.field ?? null,
      )
      const groupTitle = createViewOption<string | null>('groupTitle', null)
      const dateField = createViewOption<string | null>(
        'dateField',
        fieldGroups.value.date[0]?.field ?? null,
      )
      const tagsField = createViewOption<string | null>(
        'tagsField',
        fieldGroups.value.tags[0]?.field ?? null,
      )
      const userField = createViewOption<string | null>(
        'userField',
        fieldGroups.value.user[0]?.field ?? null,
      )
      const titleField = createViewOption<string | null>(
        'titleField',
        fieldGroups.value.title[0]?.field ?? null,
      )
      const textField = createViewOption<string | null>(
        'textField',
        fieldGroups.value.text[0]?.field ?? null,
      )
      const showUngrouped = createViewOption<boolean>('showUngrouped', false)
      const showIndex = createViewOption<boolean>('showIndex', false)
      const enableInfiniteScroll = createViewOption<boolean>(
        'enableInfiniteScroll',
        false,
      )
      const imageSource = createViewOption<string | null>(
        'imageSource',
        fieldGroups.value.file[0]?.field ?? null,
      )
      const crop = createViewOption<boolean>('crop', true)

      const selectedGroup = computed(() =>
        fieldGroups.value.group.find(
          (group) => group.field === groupField.value,
        ),
      )

      watch(groupField, () => {
        groupTitle.value = null
      })

      const userFieldJunction = computed(() => {
        if (userField.value === null) return

        return relationsStore.relations.find(
          (relation) =>
            relation.meta?.one_collection === props.collection &&
            relation.meta.one_field === userField.value &&
            relation.meta.junction_field !== null,
        )
      })

      const userFieldType = computed(() => {
        if (userField.value === null) return
        return userFieldJunction.value !== undefined ? 'm2m' : 'm2o'
      })

      return {
        groupField,
        groupTitle,
        imageSource,
        selectedGroup,
        titleField,
        textField,
        crop,
        dateField,
        tagsField,
        userField,
        showUngrouped,
        showIndex,
        enableInfiniteScroll,
        userFieldJunction,
        userFieldType,
      }

      function createViewOption<T>(
        key: keyof LayoutOptions,
        defaultValue: any,
      ) {
        return computed<T>({
          get() {
            return layoutOptions.value?.[key] !== undefined
              ? layoutOptions.value[key]
              : defaultValue
          },
          set(newValue: T) {
            layoutOptions.value = {
              ...layoutOptions.value,
              [key]: newValue,
            }
          },
        })
      }
    }

    function useGrouping() {
      const isRelational = computed(
        () => !selectedGroup.value?.meta?.options?.choices,
      )

      const groupsCollection = computed(() => {
        if (isRelational.value) {
          const field = groupField.value

          if (field === null) return null

          const relation = (relationsStore.relations as any[]).find(
            (relation) =>
              getRelationType({
                relation,
                collection: collection.value,
                field,
              }) === 'm2o',
          )

          if (relation === undefined || relation.related_collection === null)
            return null

          return relation.related_collection as string
        }

        return null
      })

      const {
        fields: groupsCollectionFields,
        sortField: groupsSortField,
        primaryKeyField: groupsPrimaryKeyField,
      } = useCollection(groupsCollection)

      const sort = computed(() => {
        if (groupsSortField.value) return [groupsSortField.value]
        if (groupsPrimaryKeyField.value?.field)
          return [groupsPrimaryKeyField.value.field]
        return []
      })

      const groupFieldsToLoad = computed(() => {
        if (primaryKeyField.value === null || groupTitle.value === null)
          return []
        return [primaryKeyField.value?.field, groupTitle.value]
      })

      const groupTitleFields = computed(() => {
        if (isRelational.value) {
          return groupsCollectionFields.value.filter(
            (field) => field.type === 'string' || field.type === 'text',
          )
        }

        return null
      })

      const limit =
        serverInfo.queryLimit?.max && serverInfo.queryLimit.max !== -1
          ? serverInfo.queryLimit.max
          : 100

      const {
        items: relationalGroupsItems,
        loading: groupsLoading,
        error: groupsError,
        changeManualSort: groupsChangeManualSort,
        getItems: getGroups,
      } = useItems(groupsCollection, {
        sort,
        limit: ref(limit),
        page: ref(1),
        fields: groupFieldsToLoad,
        filter: ref({}),
        search: ref(null),
      })

      const groups = computed(() => {
        if (isRelational.value) return relationalGroupsItems.value
        return (selectedGroup.value?.meta?.options?.choices ?? []) as Record<
          string,
          any
        >[]
      })

      return {
        groups,
        groupsLoading,
        groupsError,
        groupsChangeManualSort,
        info,
        fields,
        groupTitleFields,
        groupsPrimaryKeyField,
        groupsSortField,
        groupsCollection,
        addGroup,
        editGroup,
        deleteGroup,
        changeGroupSort,
        isRelational,
      }

      async function deleteGroup(id: string | number) {
        if (isRelational.value) {
          const pkField = primaryKeyField.value?.field
          if (pkField === undefined || !groupsCollection.value) return

          // items.value = items.value.filter((item) => item[pkField] !== id);

          await api.delete(`${getEndpoint(groupsCollection.value)}/${id}`)
        } else {
          const updatedChoices =
            selectedGroup.value?.meta?.options?.choices.filter(
              (item) => item.value !== id,
            )
          await fieldsStore.updateField(
            selectedGroup.value.collection,
            selectedGroup.value.field,
            {
              meta: {options: {choices: updatedChoices}},
            },
          )
        }

        await getGroups()
      }

      async function addGroup(title: string, value: string) {
        if (isRelational.value) {
          if (groupTitle.value === null || !groupsCollection.value) return
          await api.post(getEndpoint(groupsCollection.value), {
            [groupTitle.value]: title,
          })
        } else {
          if (!selectedGroup.value) return

          const updatedChoices = selectedGroup.value?.meta?.options?.choices

          updatedChoices.push({text: title, value: value})
          await fieldsStore.updateField(
            selectedGroup.value.collection,
            selectedGroup.value.field,
            {
              meta: {options: {choices: updatedChoices}},
            },
          )
        }

        await getGroups()
      }

      async function editGroup(
        id: string | number,
        title: string,
        value: string,
      ) {
        if (isRelational.value) {
          if (groupTitle.value === null || !groupsCollection.value) return

          await api.patch(`${getEndpoint(groupsCollection.value)}/${id}`, {
            [groupTitle.value]: title,
          })
        } else {
          if (!selectedGroup.value) return

          const updatedChoices = (
            (selectedGroup.value?.meta?.options?.choices as Record<
              string,
              any
            >[]) ?? []
          ).map((choice) => {
            if (choice.value === id) {
              return {
                ...choice,
                text: title,
                value: value,
              }
            }

            return choice
          })

          await fieldsStore.updateField(
            selectedGroup.value.collection,
            selectedGroup.value.field,
            {
              meta: {options: {choices: updatedChoices}},
            },
          )
        }

        await getGroups()
      }

      async function changeGroupSort(event: ChangeEvent<Group>) {
        if (!event.moved) return

        const offset = showUngrouped.value ? 1 : 0
        const item = groupedItems.value[event.moved.oldIndex - offset]?.id
        const to = groupedItems.value[event.moved.newIndex - offset]?.id
        // the special "ungrouped" group has null id
        if (!item || !to) return

        if (isRelational.value) {
          if (groupsSortField.value == null) return
          await groupsChangeManualSort({item, to})
        } else {
          if (!selectedGroup.value) return
          const groupedIds = groupedItems.value.map((item) => item.id)
          const currentIndex = groupedIds.indexOf(item)
          const targetIndex = groupedIds.indexOf(to)

          const newSortedChoices = moveInArray(
            groupedItems.value.map((item) => {
              return {text: item.title, value: item.id}
            }),
            currentIndex,
            targetIndex,
          )

          await fieldsStore.updateField(
            selectedGroup.value.collection,
            selectedGroup.value.field,
            {
              meta: {options: {choices: newSortedChoices}},
            },
          )
        }
      }
    }

    function useLayoutQuery() {
      const page = computed({
        get() {
          return layoutQuery.value?.page || 1
        },
        set(newPage: number) {
          layoutQuery.value = {
            ...(layoutQuery.value || {}),
            page: newPage,
          }
        },
      })

      const sort = computed(() => {
        if (sortField.value) return [sortField.value]
        if (primaryKeyField.value?.field) return [primaryKeyField.value.field]
        return []
      })

      const limit = computed({
        get() {
          return layoutQuery.value?.limit || 5
        },
        set(newLimit: number) {
          layoutQuery.value = {
            ...(layoutQuery.value || {}),
            page: 1,
            limit: newLimit,
          }
        },
      })

      const fields = computed<string[]>(() => {
        if (!primaryKeyField.value || !props.collection) return []
        const fields = [primaryKeyField.value.field]

        if (imageSource.value) {
          fields.push(`${imageSource.value}.modified_on`)
          fields.push(`${imageSource.value}.type`)
          fields.push(`${imageSource.value}.filename_disk`)
          fields.push(`${imageSource.value}.storage`)
          fields.push(`${imageSource.value}.id`)
        }

        if (
          props.collection === 'directus_files' &&
          imageSource.value === '$thumbnail'
        ) {
          fields.push('modified_on')
          fields.push('type')
        }

        if (userFieldType.value !== undefined) {
          const relatedUser =
            userFieldType.value === 'm2m'
              ? `${userField.value}.${userFieldJunction.value?.meta?.junction_field}`
              : `${userField.value}`

          fields.push(`${relatedUser}.id`)
          fields.push(`${relatedUser}.first_name`)
          fields.push(`${relatedUser}.last_name`)
          fields.push(`${relatedUser}.avatar.id`)
          fields.push(`${relatedUser}.avatar.storage`)
          fields.push(`${relatedUser}.avatar.filename_disk`)
          fields.push(`${relatedUser}.avatar.type`)
          fields.push(`${relatedUser}.avatar.modified_on`)
        }

        if (sort.value.length > 0) {
          const sortField = sort.value[0].startsWith('-')
            ? sort.value[0].substring(1)
            : sort.value[0]

          if (fields.includes(sortField) === false) {
            fields.push(sortField)
          }
        }

        ;[
          groupField.value,
          titleField.value,
          textField.value,
          tagsField.value,
          userField.value,
          dateField.value,
        ].forEach((val) => {
          if (val !== null) fields.push(val)
        })

        return fields
      })

      return {sort, limit, page, fields}
    }

    return {
      isRelational,
      groupedItems,
      groupsPrimaryKeyField,
      groups,
      groupTitle,
      groupTitleFields,
      groupField,
      imageSource,
      titleField,
      textField,
      crop,
      page,
      fieldsInCollection,
      fields,
      limit,
      primaryKeyField,
      info,
      sort,
      sortField,
      dateField,
      tagsField,
      changeGroupSort,
      groupsSortField,
      fieldGroups,
      userField,
      groupsCollection,
      addGroup,
      editGroup,
      deleteGroup,
      showUngrouped,
      showIndex,
      enableInfiniteScroll,
      userFieldType,
    }
  },
})
