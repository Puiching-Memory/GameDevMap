import { authFetch } from './auth.js';

let clubsTableBody;
let clubSearchInput;
let refreshClubsButton;
let clubsListStatus;

let clubsData = [];
let filteredClubs = [];

/**
 * 初始化元素引用
 */
function initElements() {
  if (!clubsTableBody) {
    clubsTableBody = document.getElementById('clubsTableBody');
    clubSearchInput = document.getElementById('clubSearchInput');
    refreshClubsButton = document.getElementById('refreshClubsButton');
    clubsListStatus = document.getElementById('clubsListStatus');
  }
}

/**
 * 设置状态消息
 */
function setClubsListStatus(message, type) {
  if (!clubsListStatus) return;
  clubsListStatus.textContent = message || '';
  clubsListStatus.classList.remove('is-error', 'is-success');
  if (!message) {
    return;
  }
  clubsListStatus.classList.add(type === 'success' ? 'is-success' : 'is-error');
}

/**
 * 加载所有社团
 */
async function loadClubs() {
  try {
    setClubsListStatus('加载中...', '');
    
    const response = await authFetch('/api/clubs');
    
    if (!response.success) {
      throw new Error(response.message || '加载失败');
    }

    clubsData = response.data || [];
    filteredClubs = [...clubsData];
    
    renderClubsTable();
    setClubsListStatus(`共 ${clubsData.length} 个社团`, 'success');
    
    setTimeout(() => setClubsListStatus('', ''), 3000);
  } catch (error) {
    console.error('Load clubs failed:', error);
    setClubsListStatus(`加载失败: ${error.message}`, 'error');
    clubsTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;">加载失败，请重试</td></tr>';
  }
}

/**
 * 渲染社团列表
 */
function renderClubsTable() {
  if (!clubsTableBody) {
    console.error('clubsTableBody 元素未找到');
    return;
  }
  
  if (filteredClubs.length === 0) {
    clubsTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;">暂无社团数据</td></tr>';
    return;
  }

  clubsTableBody.innerHTML = '';

  filteredClubs.forEach(club => {
    const row = document.createElement('tr');
    
    row.innerHTML = `
      <td>${escapeHTML(club.name)}</td>
      <td>${escapeHTML(club.school)}</td>
      <td>${escapeHTML(club.province)}</td>
      <td>${escapeHTML(club.city || '-')}</td>
      <td>${formatDate(club.createdAt || '')}</td>
      <td>
        <button class="action-button action-button--danger" data-club-id="${club.id}" data-action="delete">
          删除
        </button>
      </td>
    `;

    clubsTableBody.appendChild(row);
  });

  // 绑定删除按钮事件
  clubsTableBody.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', handleDeleteClub);
  });
}

/**
 * 搜索过滤
 */
function filterClubs() {
  const searchTerm = clubSearchInput.value.trim().toLowerCase();
  
  if (!searchTerm) {
    filteredClubs = [...clubsData];
  } else {
    filteredClubs = clubsData.filter(club => 
      club.name.toLowerCase().includes(searchTerm) ||
      club.school.toLowerCase().includes(searchTerm) ||
      club.province.toLowerCase().includes(searchTerm) ||
      (club.city && club.city.toLowerCase().includes(searchTerm))
    );
  }

  renderClubsTable();
  setClubsListStatus(`找到 ${filteredClubs.length} 个社团`, '');
}

/**
 * 删除社团
 */
async function handleDeleteClub(e) {
  const clubId = e.target.dataset.clubId;
  const clubRow = e.target.closest('tr');
  const clubName = clubRow.querySelector('td:first-child').textContent;
  const clubSchool = clubRow.querySelector('td:nth-child(2)').textContent;

  const confirmed = confirm(`确定要删除社团 "${clubName}" (${clubSchool}) 吗？\n\n此操作不可恢复，将同时更新数据库和 clubs.json 文件。`);
  
  if (!confirmed) {
    return;
  }

  try {
    e.target.disabled = true;
    e.target.textContent = '删除中...';

    const response = await authFetch(`/api/clubs/${clubId}`, {
      method: 'DELETE'
    });

    if (!response.success) {
      throw new Error(response.message || '删除失败');
    }

    setClubsListStatus(`已删除: ${clubName}`, 'success');
    
    // 从本地数据中移除
    clubsData = clubsData.filter(c => c.id !== clubId);
    filteredClubs = filteredClubs.filter(c => c.id !== clubId);
    
    // 重新渲染
    renderClubsTable();
    
    setTimeout(() => setClubsListStatus('', ''), 3000);
  } catch (error) {
    console.error('Delete club failed:', error);
    setClubsListStatus(`删除失败: ${error.message}`, 'error');
    e.target.disabled = false;
    e.target.textContent = '删除';
  }
}

/**
 * 格式化日期
 */
function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  } catch {
    return '-';
  }
}

/**
 * HTML 转义
 */
function escapeHTML(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * 初始化
 */
export function initClubsManagement() {
  // 初始化元素引用
  initElements();
  
  if (!clubsTableBody || !clubSearchInput || !refreshClubsButton || !clubsListStatus) {
    console.error('社团管理元素未找到');
    return;
  }

  // 绑定事件
  refreshClubsButton.addEventListener('click', loadClubs);
  
  let searchTimeout;
  clubSearchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(filterClubs, 300);
  });

  // 初始加载
  loadClubs();
}
