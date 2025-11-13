const TOKEN_KEY = 'gamedevmap_admin_token';
const USER_KEY = 'gamedevmap_admin_user';

function persistSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function loadStoredUser() {
  const stored = localStorage.getItem(USER_KEY);
  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored);
  } catch (error) {
    console.warn('无法解析本地存储的用户信息，将清除。');
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function getStoredUser() {
  return loadStoredUser();
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function ensureJson(response) {
  return response.json().catch(() => null);
}

export async function login(username, password) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ username, password })
  });

  const result = await ensureJson(response);

  if (!response.ok || !result?.success) {
    // 优先使用后端返回的详细错误信息
    let errorMessage = result?.message || '登录失败';
    
    // 根据状态码补充更详细的错误信息
    if (!response.ok) {
      if (response.status === 400) {
        errorMessage = result?.message || '请输入用户名和密码';
      } else if (response.status === 401) {
        errorMessage = result?.message || '账号或密码错误，请检查输入';
      } else if (response.status === 403) {
        errorMessage = result?.message || '该账号已被禁用';
      } else if (response.status === 429) {
        errorMessage = '登录尝试次数过多，请稍后再试';
      } else if (response.status >= 500) {
        errorMessage = '服务器错误，请稍后再试';
      }
    }
    
    throw new Error(errorMessage);
  }

  persistSession(result.data.token, result.data.user);
  return result.data.user;
}

export async function verifyToken() {
  const token = getToken();
  if (!token) {
    throw new Error('缺少登录凭证');
  }

  const response = await fetch('/api/auth/verify', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const result = await ensureJson(response);

  if (!response.ok || !result?.success) {
    // 如果是服务不可用（数据库连接问题），不要清除session
    if (response.status === 503 || result?.error === 'SERVICE_UNAVAILABLE') {
      console.warn('数据库连接暂时不可用，稍后重试...');
      throw new Error('SERVICE_UNAVAILABLE');
    }

    clearSession();
    let errorMessage = result?.message || '登录状态已失效，请重新登录';

    // 根据状态码补充更详细的错误信息
    if (!response.ok) {
      if (response.status === 401) {
        errorMessage = result?.message || 'Token已过期或无效，请重新登录';
      } else if (response.status === 403) {
        errorMessage = result?.message || '权限不足';
      } else if (response.status >= 500) {
        errorMessage = '服务器错误，请稍后再试';
      }
    }

    throw new Error(errorMessage);
  }

  persistSession(token, result.data.user);
  return result.data.user;
}

export async function authFetch(url, options = {}) {
  const token = getToken();
  if (!token) {
    throw new Error('缺少登录凭证');
  }

  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  return response;
}

export function getAuthHeaders() {
  const token = getToken();
  if (!token) {
    return {};
  }
  return {
    'Authorization': `Bearer ${token}`
  };
}

export async function checkAuth() {
  const storedUser = getStoredUser();
  if (!storedUser) {
    // 没有存储的用户信息，重定向到登录页面
    window.location.href = '/admin/';
    return;
  }

  try {
    // 验证 token 是否仍然有效
    await verifyToken();
  } catch (error) {
    console.warn('认证检查失败：', error.message);
    clearSession();
    window.location.href = '/admin/';
  }
}

export async function logout() {
  clearSession();
  window.location.href = '/admin/';
}
