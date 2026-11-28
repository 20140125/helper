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
import './styles/app-background.css';
import { useLocaleStore } from './stores/locale';
import { useAppBackgroundStore } from './stores/app-background';

const app = createApp(App);

const pinia = createPinia();
app.use(pinia);
// 启动时拉取数据库语言包；失败或库不可用时降级到 localStorage 缓存
void useLocaleStore(pinia).loadFromDatabase();
// 启动时读取系统背景图（公开接口，失败时静默使用默认主题）
void useAppBackgroundStore(pinia).load();
app.use(router);
app.use(TDesign);
app.mount('#app');
