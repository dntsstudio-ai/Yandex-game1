import './styles/main.css';
import { App } from './ui/app';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Не найден контейнер #app');

new App(root);
