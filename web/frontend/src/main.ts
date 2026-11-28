import { createApp } from 'vue';
import { createPinia } from 'pinia';
import TDesign from 'tdesign-vue-next';
import router from './router';
import App from './app.vue';
import 'tdesign-vue-next/es/style/index.css';
import 'tdesign-icons-vue-next/dist/index.css';
import './styles/style.css';
import './styles/t-button-overrides.css';
import './styles/ai-chat-skin.css';
import { useLocaleStore } from './stores/locale';

const app = createApp(App);

const pinia = createPinia();
app.use(pinia);
// 启动时拉取数据库语言包；失败或库不可用时静默降级到内置 zh.ts / en.ts
void useLocaleStore(pinia).loadFromDatabase();
app.use(router);
app.use(TDesign);
app.mount('#app');
