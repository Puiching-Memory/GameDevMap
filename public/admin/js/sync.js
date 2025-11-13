import { checkAuth, logout, getAuthHeaders } from './auth.js';

// Check authentication on page load
checkAuth();

// DOM elements
const logoutBtn = document.getElementById('logoutBtn');
const compareBtn = document.getElementById('compareBtn');
const mergeBtn = document.getElementById('mergeBtn');
const replaceBtn = document.getElementById('replaceBtn');
const messageContainer = document.getElementById('messageContainer');
const statsContainer = document.getElementById('statsContainer');
const comparisonContainer = document.getElementById('comparisonContainer');

// Logout handler
logoutBtn.addEventListener('click', logout);

// Tab switching
const tabBtns = document.querySelectorAll('.tab-btn');
tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const tabName = btn.getAttribute('data-tab');
    switchTab(tabName);
  });
});

function switchTab(tabName) {
  // Update button states
  tabBtns.forEach(btn => {
    if (btn.getAttribute('data-tab') === tabName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Update content visibility
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  document.getElementById(`${tabName}Tab`).classList.add('active');
}

// Compare data
compareBtn.addEventListener('click', async () => {
  try {
    compareBtn.disabled = true;
    compareBtn.textContent = '对比中...';
    clearMessage();

    const response = await fetch('/api/sync/compare', {
      headers: getAuthHeaders()
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || '对比失败');
    }

    displayComparisonResults(result.data);
    showMessage('数据对比完成', 'success');

  } catch (error) {
    console.error('Compare error:', error);
    showMessage(error.message || '对比失败，请重试', 'error');
  } finally {
    compareBtn.disabled = false;
    compareBtn.textContent = '对比数据';
  }
});

// Merge data
mergeBtn.addEventListener('click', async () => {
  if (!confirm('确定要执行智能合并吗？\n\n此操作将：\n- 更新 JSON 中的数据库记录\n- 添加数据库中的新记录\n- 保留 JSON 中独有的记录')) {
    return;
  }

  try {
    mergeBtn.disabled = true;
    mergeBtn.textContent = '合并中...';
    clearMessage();

    const response = await fetch('/api/sync/merge', {
      method: 'POST',
      headers: getAuthHeaders()
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || '合并失败');
    }

    showMessage(
      `智能合并完成！\n添加: ${result.data.added}\n更新: ${result.data.updated}\n保留: ${result.data.preserved}\n未变: ${result.data.unchanged}`,
      'success'
    );

    // Refresh comparison
    compareBtn.click();

  } catch (error) {
    console.error('Merge error:', error);
    showMessage(error.message || '合并失败，请重试', 'error');
  } finally {
    mergeBtn.disabled = false;
    mergeBtn.textContent = '智能合并';
  }
});

// Replace data
replaceBtn.addEventListener('click', async () => {
  if (!confirm('⚠️ 警告：完全替换模式\n\n此操作将用数据库数据完全覆盖 JSON 文件！\nJSON 中独有的记录将被删除。\n\n确定要继续吗？')) {
    return;
  }

  try {
    replaceBtn.disabled = true;
    replaceBtn.textContent = '替换中...';
    clearMessage();

    const response = await fetch('/api/sync/replace', {
      method: 'POST',
      headers: getAuthHeaders()
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || '替换失败');
    }

    showMessage(
      `完全替换完成！\n总计: ${result.data.total} 个社团`,
      'success'
    );

    // Refresh comparison
    compareBtn.click();

  } catch (error) {
    console.error('Replace error:', error);
    showMessage(error.message || '替换失败，请重试', 'error');
  } finally {
    replaceBtn.disabled = false;
    replaceBtn.textContent = '完全替换';
  }
});

// Display comparison results
function displayComparisonResults(data) {
  const { stats, details } = data;

  // Update stats
  document.getElementById('dbTotal').textContent = stats.database.total;
  document.getElementById('jsonTotal').textContent = stats.json.total;
  document.getElementById('identicalCount').textContent = stats.comparison.identical;
  document.getElementById('differentCount').textContent = stats.comparison.different;
  document.getElementById('dbOnlyCount').textContent = stats.comparison.dbOnly;
  document.getElementById('jsonOnlyCount').textContent = stats.comparison.jsonOnly;

  statsContainer.style.display = 'block';
  comparisonContainer.style.display = 'block';

  // Render lists
  renderIdenticalList(details.identical);
  renderDifferentList(details.different);
  renderDbOnlyList(details.dbOnly);
  renderJsonOnlyList(details.jsonOnly);
  renderConflictsList(details.conflicts);
}

function renderIdenticalList(clubs) {
  const container = document.getElementById('identicalList');
  
  if (clubs.length === 0) {
    container.innerHTML = '<p class="loading">没有完全相同的社团</p>';
    return;
  }

  container.innerHTML = clubs.map(item => `
    <div class="club-item">
      <div class="club-header">
        <div>
          <div class="club-name">${escapeHtml(item.club.name)}</div>
          <div class="club-school">${escapeHtml(item.club.school)}</div>
        </div>
        <span class="badge success">✓ 同步</span>
      </div>
    </div>
  `).join('');
}

function renderDifferentList(clubs) {
  const container = document.getElementById('differentList');
  
  if (clubs.length === 0) {
    container.innerHTML = '<p class="loading">没有差异</p>';
    return;
  }

  container.innerHTML = clubs.map(item => `
    <div class="diff-item">
      <div class="club-header">
        <div>
          <div class="club-name">${escapeHtml(item.db.name)}</div>
          <div class="club-school">${escapeHtml(item.db.school)}</div>
        </div>
        <span class="badge warning">${item.differences.length} 个差异</span>
      </div>
      ${item.differences.map(diff => `
        <div style="margin-top: 1rem;">
          <div class="diff-field">字段: ${diff.field}</div>
          <div class="diff-values">
            <div>
              <div class="diff-label">数据库值</div>
              <div class="diff-value db">${formatValue(diff.database)}</div>
            </div>
            <div>
              <div class="diff-label">JSON 值</div>
              <div class="diff-value json">${formatValue(diff.json)}</div>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `).join('');
}

function renderDbOnlyList(clubs) {
  const container = document.getElementById('dbOnlyList');
  
  if (clubs.length === 0) {
    container.innerHTML = '<p class="loading">所有数据库记录都在 JSON 中</p>';
    return;
  }

  container.innerHTML = clubs.map(club => `
    <div class="club-item">
      <div class="club-header">
        <div>
          <div class="club-name">${escapeHtml(club.name)}</div>
          <div class="club-school">${escapeHtml(club.school)}</div>
        </div>
        <span class="badge info">仅在数据库</span>
      </div>
    </div>
  `).join('');
}

function renderJsonOnlyList(clubs) {
  const container = document.getElementById('jsonOnlyList');
  
  if (clubs.length === 0) {
    container.innerHTML = '<p class="loading">所有 JSON 记录都在数据库中</p>';
    return;
  }

  container.innerHTML = clubs.map(club => `
    <div class="club-item">
      <div class="club-header">
        <div>
          <div class="club-name">${escapeHtml(club.name)}</div>
          <div class="club-school">${escapeHtml(club.school)}</div>
        </div>
        <span class="badge danger">⚠️ 仅在 JSON</span>
      </div>
    </div>
  `).join('');
}

function renderConflictsList(conflicts) {
  const container = document.getElementById('conflictsList');
  
  if (conflicts.length === 0) {
    container.innerHTML = '<p class="loading">没有冲突</p>';
    return;
  }

  container.innerHTML = conflicts.map(item => `
    <div class="diff-item">
      <div class="club-header">
        <div>
          <div class="club-name">${escapeHtml(item.db.name)}</div>
          <div class="club-school">${escapeHtml(item.db.school)}</div>
        </div>
        <span class="badge danger">⚠️ ID 冲突</span>
      </div>
      <div style="margin-top: 1rem;">
        <div class="diff-values">
          <div>
            <div class="diff-label">数据库 ID</div>
            <div class="diff-value db">${item.db.id}</div>
          </div>
          <div>
            <div class="diff-label">JSON ID</div>
            <div class="diff-value json">${item.json.id}</div>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

// Utility functions
function showMessage(message, type = 'info') {
  const className = type === 'error' ? 'error-message' : 'success-message';
  messageContainer.innerHTML = `<div class="${className}">${escapeHtml(message).replace(/\n/g, '<br>')}</div>`;
}

function clearMessage() {
  messageContainer.innerHTML = '';
}

function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

function formatValue(value) {
  if (value === null || value === undefined) {
    return '<em>空</em>';
  }
  if (typeof value === 'object') {
    return escapeHtml(JSON.stringify(value, null, 2));
  }
  return escapeHtml(String(value));
}
