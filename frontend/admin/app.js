import { ref } from 'vue';
import LoginView from './LoginView.js';
import AdminPanel from './AdminPanel.js';

export default {
  components: {
    LoginView,
    AdminPanel,
  },
  setup() {
    // Check local storage directly on load
    const token = ref(localStorage.getItem('admin_token') || '');

    const handleLoginSuccess = newToken => {
      token.value = newToken;
    };

    const handleLogout = () => {
      localStorage.removeItem('admin_token');
      token.value = '';
    };

    return {
      token,
      handleLoginSuccess,
      handleLogout,
    };
  },
  template: `
        <div>
            <AdminPanel 
                v-if="token" 
                @logout="handleLogout" 
            />
            <LoginView 
                v-else 
                @login-success="handleLoginSuccess" 
            />
        </div>
    `,
};
