import { read } from '../services/repository.js';
export const getUser = () => read().accounts.find(a => a.id === sessionStorage.getItem('hocvu-account'));
