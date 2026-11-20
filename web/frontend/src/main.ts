import { createApp } from 'vue';
import { createPinia } from 'pinia';
import TDesign from 'tdesign-vue-next';
import router from './router';
import App from './app.vue';
import 'tdesign-vue-next/es/style/index.css';
import 'tdesign-icons-vue-next/dist/index.css';
import './styles/style.css';
import './styles/t-button-overrides.css';

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(TDesign);
app.mount('#app');
