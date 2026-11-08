import { navigation } from './navigation.js';
export function canOpenView(user, view) {
    const available = navigation[user.role] || [];
    return [...available.map(item => item[0]), 'account',
        ...(user.role === 'academic' ? ['profile', 'group'] : ['lecturer', 'student'].includes(user.role) ? ['profile'] : [])
    ].includes(view);
}
