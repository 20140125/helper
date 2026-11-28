// ==============================
// 知识库工具函数兼容层
// @description 历史调用方从 ./storage 导入；实现已拆分为 files / dirs / state / mutations
// ==============================
export {
  normalizeDocName,
  isUserDocPath,
  getDocContentBytes,
  resolveDocPath,
  scanKnowledgeFileDocs,
  readDocByPathFromFile,
  readKnowledgeDocFile,
  writeKnowledgeDocFile,
  deleteKnowledgeDocFile,
} from './files';
export {
  readKnowledgeDirs,
  normalizeKnowledgeDirs,
  writeKnowledgeDirs,
  resolveKnowledgeDirPaths,
} from './dirs';
export {
  initKnowledgeDocs,
  refreshKnowledgeDocs,
  getKnowledgeDocEntries,
  listKnowledgeDocs,
  readKnowledgeDoc,
  readDocByPath,
} from './state';
export {
  writeKnowledgeDoc,
  deleteKnowledgeDoc,
  importSystemDoc,
} from './mutations';
