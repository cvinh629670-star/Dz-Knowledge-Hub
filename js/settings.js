import {makeBackup, parseBackup, readState, replaceState, sampleState} from './database.js';
import {localDay} from './gamification.js';
import {confirmAction, esc, icon, number, pageHeader} from './ui.js';

function downloadBackup(backup) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], {type:'application/json'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'dz-knowledge-hub-' + localDay() + '.json';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function renderSettings(ctx) {
  const {root, state} = ctx;
  root.innerHTML = pageHeader({title:'Cài đặt & dữ liệu', description:'Cá nhân hóa kho tri thức và quản lý bản sao lưu của bạn.', icon:'settings'}) + `
    <div class="settings-grid">
      <section class="panel panel-pad stack">
        <div class="section-head"><span class="tile-icon violet">${icon('user')}</span><div><h2>Hồ sơ cá nhân</h2><p class="muted">Hiển thị tên và mục tiêu ở trang tổng quan.</p></div></div>
        <form id="profile-form" class="stack">
          <label class="field">Tên hiển thị<input name="name" maxlength="40" required value="${esc(state.profile.name)}"></label>
          <label class="field">Mục tiêu hiện tại<textarea name="goal" maxlength="180" rows="3" placeholder="Ví dụ: Viết ứng dụng Python đầu tiên">${esc(state.profile.goal)}</textarea></label>
          <label class="field">Mục tiêu mỗi ngày <small>Số hoạt động học mà bạn muốn hoàn thành.</small>
            <input type="number" name="dailyGoal" min="1" max="30" required value="${state.profile.dailyGoal}">
          </label>
          <button class="btn btn-primary" type="submit">${icon('check',18)} Lưu hồ sơ</button>
        </form>
      </section>
      <div class="stack">
        <section class="panel panel-pad stack">
          <div class="section-head"><span class="tile-icon blue">${icon('sun')}</span><div><h2>Giao diện</h2><p class="muted">Chế độ hiển thị trên thiết bị này.</p></div></div>
          <label class="field">Chủ đề giao diện
            <select id="theme-choice"><option value="dark">Tối</option><option value="light">Sáng</option></select>
          </label>
        </section>
        <section class="panel panel-pad stack">
          <div class="section-head"><span class="tile-icon teal">${icon('database')}</span><div><h2>Sao lưu và khôi phục</h2><p class="muted">Dữ liệu được tự động lưu trong trình duyệt.</p></div></div>
          <p class="storage-summary">${number(state.lessons.length)} bài học · ${number(state.flashcards.length)} flashcard · ${number(state.activity.length)} hoạt động</p>
          <div class="inline-actions">
            <button type="button" class="btn btn-secondary" id="export-data">${icon('download',18)} Xuất JSON</button>
            <button type="button" class="btn btn-secondary" id="import-data">${icon('upload',18)} Nhập JSON</button>
            <input type="file" id="backup-file" accept=".json,application/json" hidden>
          </div>
          <p class="feedback" id="backup-feedback" role="status" hidden></p>
        </section>
        <section class="panel panel-pad stack">
          <div class="section-head"><span class="tile-icon rose">${icon('trash')}</span><div><h2>Đặt lại kho tri thức</h2><p class="muted">Xóa nội dung, tiến độ và hồ sơ trên thiết bị này rồi nạp lại bộ mẫu Python.</p></div></div>
          <button type="button" class="btn btn-danger" id="reset-data">Đặt lại dữ liệu</button>
        </section>
      </div>
    </div>`;

  const theme = root.querySelector('#theme-choice');
  theme.value = ctx.theme();
  theme.addEventListener('change', () => ctx.setTheme(theme.value));
  const form = root.querySelector('#profile-form');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const fields = new FormData(form);
    const name = fields.get('name').trim();
    const goal = fields.get('goal').trim();
    const dailyGoal = Number(fields.get('dailyGoal'));
    if (!name) { ctx.toast('Nhập tên hiển thị hợp lệ.', 'error'); return; }
    try {
      await ctx.update(data => { data.profile = {name, goal, dailyGoal}; });
      ctx.toast('Đã lưu hồ sơ.');
    } catch { ctx.toast('Không thể lưu hồ sơ. Hãy thử lại.', 'error'); }
  });

  root.querySelector('#export-data').addEventListener('click', async () => {
    try {
      downloadBackup(makeBackup(await readState(), ctx.theme()));
      ctx.toast('Đã xuất bản sao lưu JSON.');
    } catch { ctx.toast('Không thể xuất bản sao lưu.', 'error'); }
  });

  const fileInput = root.querySelector('#backup-file');
  const importButton = root.querySelector('#import-data');
  const feedback = root.querySelector('#backup-feedback');
  importButton.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    importButton.disabled = true;
    feedback.hidden = true;
    try {
      const backup = parseBackup(await file.text());
      const ok = await confirmAction(`Bản sao này có ${backup.data.lessons.length} bài học và ${backup.data.activity.length} hoạt động. Khôi phục sẽ thay thế toàn bộ dữ liệu hiện tại.`, {title:'Khôi phục bản sao lưu', label:'Khôi phục'});
      if (!ok) return;
      await replaceState(backup.data);
      ctx.adopt(backup.data);
      ctx.setTheme(backup.theme);
      ctx.toast('Đã khôi phục bản sao lưu.');
      ctx.refresh();
    } catch (error) {
      feedback.textContent = error instanceof SyntaxError ? 'Tệp được chọn chứa JSON không hợp lệ.' : error.message;
      feedback.hidden = false;
    } finally { importButton.disabled = false; }
  });

  const reset = root.querySelector('#reset-data');
  reset.addEventListener('click', async () => {
    const ok = await confirmAction('Dữ liệu cá nhân sẽ bị thay thế bằng bộ mẫu Python. Hãy xuất JSON trước nếu bạn muốn giữ bản sao.', {title:'Đặt lại dữ liệu?', label:'Đặt lại'});
    if (!ok) return;
    reset.disabled = true;
    try {
      const data = await sampleState();
      await replaceState(data);
      ctx.adopt(data);
      ctx.toast('Đã đặt lại kho tri thức.');
      ctx.refresh();
    } catch { ctx.toast('Không thể đặt lại kho tri thức.', 'error'); }
    finally { reset.disabled = false; }
  });
}
