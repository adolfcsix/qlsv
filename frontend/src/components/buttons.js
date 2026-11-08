export const btn = (text, action = '', kind = '', attrs = '') => `<button type="button" class="btn ${kind}" ${action ? `data-action="${action}"` : ''} ${attrs}>${text}</button>`;
export const link = (text, href, cls = '') => `<a class="${cls}" ${cls.split(' ').includes('active') ? 'aria-current="page"' : ''} href="#${href}">${text}</a>`;
