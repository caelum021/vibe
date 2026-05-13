import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

export const listFiles = (path = '', { includeMtime = false } = {}) =>
  invoke('list_files', { path: path || null, includeMtime })

export const listAllFiles = () =>
  invoke('list_all_files')

export const readFile = (path) =>
  invoke('read_file', { path })

export const readImage = (path) =>
  invoke('read_image', { path })

export const writeFile = (path, content) =>
  invoke('write_file', { path, content })

export const createItem = (path, isDirectory) =>
  invoke('create_item', { path, isDirectory })

export const deleteItem = (path) =>
  invoke('delete_item', { path })

export const renameItem = (oldPath, newPath) =>
  invoke('rename_item', { oldPath, newPath })

export const setRoot = (path) =>
  invoke('set_root', { path })

export const getRoot = () =>
  invoke('get_root')

export const pickFolder = () =>
  invoke('pick_folder')

export const gitStatus = () =>
  invoke('git_status')

export const gitDiff = (path) =>
  invoke('git_diff', { path })

export const getOutgoingLinks = (path) =>
  invoke('get_outgoing_links', { path })

export const getBacklinks = (path) =>
  invoke('get_backlinks', { path })

export const getBrokenLinks = () =>
  invoke('get_broken_links')

export const getOrphanDocs = () =>
  invoke('get_orphan_docs')

export const getGraphData = () =>
  invoke('get_graph_data')

export const openExternal = (url) =>
  invoke('open_external', { url })

export const onFileChanged = (callback) =>
  listen('file-changed', (event) => callback(event.payload))

export const onLinkIndexReady = (callback) =>
  listen('link-index-ready', (event) => callback(event.payload))
