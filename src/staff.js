/**
 * Служебная страница сотрудников «Лиги»: обмен файлами, задачи и календарь.
 *
 * Чтобы заработало, нужно заполнить ключи подключения к Supabase
 * (см. константы SUPABASE_URL и SUPABASE_ANON_KEY ниже) и выполнить
 * скрипт supabase-schema.sql из корня сайта в SQL Editor проекта Supabase.
 */
(function () {
    'use strict';

    // =============================================================
    // ⚠ ЗАПОЛНИТЕ ПЕРЕД ПУБЛИКАЦИЕЙ (обязательно):
    //   URL проекта  — Dashboard → Project Settings → API → Project URL
    //   anon key      — Dashboard → Project Settings → API → anon public key
    // =============================================================
    const SUPABASE_URL = 'https://fmonxvjihcdbeklmwtmm.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_nnM6PLC-FaIBSIVWBPm7aw_eAn3L_ks';

    const BUCKET = 'staff'; // имя bucket-а для файлов (см. supabase-schema.sql)

    const STATUS_OK = 'ok';
    const STATUS_ERROR = 'error';
    const STATUS_OFFLINE = 'offline';

    // Ключ localStorage с датой последнего визита для бейджа «Новый файл»
    const LAST_VISIT_KEY = 'staffLastVisit';

    let supabase = null;

    // DOM-элементы
    const statusEl = document.getElementById('staffStatus');
    const statusText = document.getElementById('staffStatusText');
    const btnPick = document.getElementById('staffFilePick');
    const btnSubmit = document.getElementById('staffTaskSubmit');
    const fileInput = document.getElementById('staffFileInput');
    const dropzone = document.getElementById('staffDropzone');
    const fileListEl = document.getElementById('staffFileList');
    const fileListEmpty = document.getElementById('staffFileListEmpty');
    const taskForm = document.getElementById('staffTaskForm');
    const taskTitle = document.getElementById('staffTaskTitle');
    const taskDate = document.getElementById('staffTaskDate');
    const tasksOverdue = document.getElementById('staffTasksOverdue');
    const tasksToday = document.getElementById('staffTasksToday');
    const tasksLater = document.getElementById('staffTasksLater');
    const tasksEmpty = document.getElementById('staffTasksEmpty');

    // ---------------------------------------------------------------
    // Вспомогательные функции
    // ---------------------------------------------------------------
    function setStatus(state, message) {
        statusEl.dataset.state = state;
        statusText.textContent = message;
    }

    function setReady(ready) {
        [btnPick, taskTitle, taskDate, btnSubmit].forEach((el) => {
            if (el) el.disabled = !ready;
        });
    }

    function formatBytes(bytes) {
        if (!bytes) return '';
        const units = ['Б', 'КБ', 'МБ', 'ГБ'];
        let value = bytes;
        let unit = 0;
        while (value >= 1024 && unit < units.length - 1) {
            value /= 1024;
            unit += 1;
        }
        return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unit]}`;
    }

    function formatDate(value, withTime) {
        if (!value) return '';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return String(value);
        const date = d.toLocaleDateString('ru-RU');
        if (!withTime) return date;
        const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        return `${date}, ${time}`;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = String(text || '');
        return div.innerHTML;
    }

    // Всплывающее уведомление (тост)
    function showToast(message, type) {
        const toast = document.createElement('div');
        toast.className = `staff-toast staff-toast--${type || 'info'}`;
        const icon = type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-xmark' : 'fa-bell';
        toast.innerHTML = `<i class="fas ${icon}"></i><span>${escapeHtml(message)}</span>`;
        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('staff-toast--show'));
        setTimeout(() => {
            toast.classList.remove('staff-toast--show');
            setTimeout(() => toast.remove(), 400);
        }, 6000);
    }

    // ---------------------------------------------------------------
    // Подключение к Supabase
    // ---------------------------------------------------------------
    function initSupabase() {
        if (typeof window.supabase === 'undefined') {
            setStatus(STATUS_OFFLINE, 'Библиотека supabase-js не загружена.');
            return;
        }
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            setStatus(
                STATUS_OFFLINE,
                'Подключение к хранилищу не настроено. Заполните SUPABASE_URL и SUPABASE_ANON_KEY в файле staff.js.'
            );
            return;
        }
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        checkConnection();
    }

    async function checkConnection() {
        try {
            const { error } = await supabase.from('staff_files').select('id').limit(1);
            if (error) throw error;
            setStatus(STATUS_OK, 'Хранилище подключено. Можно обмениваться файлами и задачами.');
            setReady(true);
            loadFiles();
            loadTasks();
        } catch (err) {
            setStatus(
                STATUS_ERROR,
                `Не удалось подключиться к хранилищу: ${err.message || err}. Проверьте ключи в staff.js и выполните supabase-schema.sql.`
            );
        }
    }

    // ---------------------------------------------------------------
    // Файлы
    // ---------------------------------------------------------------
    function toggleEmpty(state) {
        if (fileListEmpty) fileListEmpty.hidden = !state;
    }

    async function loadFiles() {
        try {
            const { data, error } = await supabase
                .from('staff_files')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) throw error;

            fileListEl.querySelectorAll('.staff-file').forEach((el) => el.remove());
            toggleEmpty(!data || data.length === 0);

            if (!data || data.length === 0) return;

            const lastVisit = Number(localStorage.getItem(LAST_VISIT_KEY) || 0);
            const now = Date.now();

            data.forEach((file, index) => {
                const isNew = lastVisit > 0 && new Date(file.created_at).getTime() > lastVisit;
                const li = document.createElement('li');
                li.className = 'staff-file' + (isNew ? ' staff-file--new' : '');
                li.innerHTML = `
                    <div class="staff-file__icon"><i class="fas fa-file"></i></div>
                    <div class="staff-file__info">
                        <div class="staff-file__name">${escapeHtml(file.name)}</div>
                        <div class="staff-file__meta">
                            ${escapeHtml(file.author || 'Сотрудник')} ·
                            ${formatBytes(file.size_bytes)} ·
                            ${formatDate(file.created_at, true)}
                            ${isNew ? '<span class="staff-file__badge">Новый' : ''}${isNew ? '</span>' : ''}
                        </div>
                    </div>
                    <div class="staff-file__actions">
                        <button type="button" class="btn btn--small btn--outline btn--download" data-path="${escapeHtml(file.storage_path)}" data-name="${escapeHtml(file.name)}">
                            <i class="fas fa-download"></i> Скачать
                        </button>
                        <button type="button" class="staff-file__delete" data-id="${file.id}" title="Удалить файл" aria-label="Удалить файл">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>`;
                fileListEl.appendChild(li);

                // Уведомляем о новом файле
                if (isNew && index === 0) {
                    showToast(`Новый файл: «${file.name}»`, 'success');
                }
            });

            // Новая дата последнего визита — «новизна» сохранится лишь до следующего визита
            localStorage.setItem(LAST_VISIT_KEY, String(now));
        } catch (err) {
            setStatus(STATUS_ERROR, `Ошибка загрузки списка файлов: ${err.message || err}`);
        }
    }

    async function uploadFiles(fileList) {
        const files = Array.from(fileList || []).filter((f) => f && f.size > 0);
        if (!files.length) return;

        for (const file of files) {
            const storagePath = `${Date.now()}-${file.name.replace(/[^\wа-яё.-]+/gi, '_')}`;
            try {
                // 1. Сам файл — в Storage
                const { error: upError } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
                    cacheControl: '3600',
                    upsert: false
                });
                if (upError) throw upError;

                // 2. Метаданные — в таблицу staff_files
                const { error: dbError } = await supabase.from('staff_files').insert({
                    name: file.name,
                    size_bytes: file.size,
                    author: 'Сотрудник', // позже подставим имя из логина
                    storage_path: storagePath,
                    file_type: file.type || null
                });
                if (dbError) throw dbError;

                showToast(`Файл «${file.name}» загружен.`, 'success');
            } catch (err) {
                showToast(`Не удалось загрузить «${file.name}»: ${err.message}.`, 'error');
                return;
            }
        }
        fileInput.value = '';
        loadFiles();
        if (dropzone) dropzone.hidden = true;
    }

    function downloadFile(path, name) {
        (async () => {
            try {
                const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60);
                if (error) throw error;
                const a = document.createElement('a');
                a.href = data.signedUrl;
                a.download = name || '';
                document.body.appendChild(a);
                a.click();
                a.remove();
            } catch (err) {
                showToast(`Не удалось скачать файл: ${err.message}`, 'error');
            }
        })();
    }

    async function deleteFile(id) {
        if (!confirm('Удалить этот файл? Действие нельзя отменить.')) return;
        try {
            const { error } = await supabase.from('staff_files').delete().eq('id', id);
            if (error) throw error;
            showToast('Файл удалён.', 'success');
            loadFiles();
        } catch (err) {
            showToast(`Не удалось удалить файл: ${err.message}`, 'error');
        }
    }

    // ---------------------------------------------------------------
    // Задачи и календарь
    // ---------------------------------------------------------------
    function taskGroupTitle(dateStr) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const date = new Date(dateStr + 'T00:00:00');
        const diff = Math.round((date - today) / 86400000);
        if (diff < 0) return 'Просрочено';
        if (diff === 0) return 'Сегодня';
        if (diff === 1) return 'Завтра';
        return `Через ${diff} дн.`;
    }

    async function loadTasks() {
        try {
            const { data, error } = await supabase
                .from('staff_tasks')
                .select('*')
                .order('due_date', { ascending: true });
            if (error) throw error;

            [tasksOverdue, tasksToday, tasksLater].forEach((el) => {
                if (el) el.innerHTML = '';
            });

            if (!data || data.length === 0) {
                if (tasksEmpty) tasksEmpty.hidden = false;
                return;
            }
            if (tasksEmpty) tasksEmpty.hidden = true;

            data.forEach((task) => {
                const group = taskGroupTitle(task.due_date);
                const li = document.createElement('li');
                li.className = 'task-item' + (task.is_done ? ' task-item--done' : '');
                li.innerHTML = `
                    <button type="button" class="task-item__done" data-id="${task.id}" title="Отметить выполненным" aria-label="Отметить выполненным">
                        <i class="fas ${task.is_done ? 'fa-circle-check' : 'fa-circle'}"></i>
                    </button>
                    <div class="task-item__body">
                        <span class="task-item__title">${escapeHtml(task.title)}</span>
                        <span class="task-item__meta">${taskGroupTitle(task.due_date)} · ${formatDate(task.due_date)}</span>
                    </div>
                    <button type="button" class="task-item__delete" data-id="${task.id}" title="Удалить задачу" aria-label="Удалить задачу">
                        <i class="fas fa-trash"></i>
                    </button>`;
                if (group === 'Просрочено') tasksOverdue.appendChild(li);
                else if (group === 'Сегодня' || group === 'Завтра') tasksToday.appendChild(li);
                else tasksLater.appendChild(li);
            });
        } catch (err) {
            setStatus(STATUS_ERROR, `Ошибка загрузки задач: ${err.message || err}`);
        }
    }

    async function addTask(title, dueDate) {
        try {
            const { error } = await supabase.from('staff_tasks').insert({
                title,
                due_date: dueDate,
                author: 'Сотрудник'
            });
            if (error) throw error;
            showToast('Задача добавлена.', 'success');
            taskTitle.value = '';
            loadTasks();
        } catch (err) {
            showToast(`Не удалось добавить задачу: ${err.message}`, 'error');
        }
    }

    async function toggleTask(id, done) {
        try {
            const { error } = await supabase.from('staff_tasks').update({ is_done: done }).eq('id', id);
            if (error) throw error;
            loadTasks();
        } catch (err) {
            showToast(`Не удалось обновить задачу: ${err.message}`, 'error');
        }
    }

    async function deleteTask(id) {
        if (!confirm('Удалить задачу?')) return;
        try {
            const { error } = await supabase.from('staff_tasks').delete().eq('id', id);
            if (error) throw error;
            loadTasks();
        } catch (err) {
            showToast(`Не удалось удалить задачу: ${err.message}`, 'error');
        }
    }

    // ---------------------------------------------------------------
    // События интерфейса
    // ---------------------------------------------------------------
    function bindEvents() {
        if (btnPick && fileInput) {
            btnPick.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', () => uploadFiles(fileInput.files));
        }

        if (dropzone) {
            ['dragenter', 'dragover'].forEach((evt) =>
                dropzone.addEventListener(evt, (e) => {
                    e.preventDefault();
                    dropzone.classList.add('staff-dropzone--active');
                })
            );
            ['dragleave', 'drop'].forEach((evt) =>
                dropzone.addEventListener(evt, (e) => {
                    e.preventDefault();
                    dropzone.classList.remove('staff-dropzone--active');
                })
            );
            dropzone.addEventListener('drop', (e) => uploadFiles(e.dataTransfer.files));
        }

        // Загруженные файлы подсвечивают dropzone
        if (btnPick) {
            ['dragenter', 'dragover'].forEach((evt) =>
                window.addEventListener(evt, (e) => {
                    if (!supabase) return;
                    e.preventDefault();
                    if (dropzone) dropzone.hidden = false;
                })
            );
            ['dragleave', 'drop'].forEach((evt) =>
                window.addEventListener(evt, (e) => {
                    if (!supabase) return;
                    e.preventDefault();
                })
            );
        }

        fileListEl.addEventListener('click', (e) => {
            const dl = e.target.closest('.btn--download');
            if (dl) {
                downloadFile(dl.dataset.path, dl.dataset.name);
                return;
            }
            const del = e.target.closest('.staff-file__delete');
            if (del) deleteFile(del.dataset.id);
        });

        if (taskForm) {
            taskForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const title = taskTitle.value.trim();
                const date = taskDate.value;
                if (!title || !date) return;
                addTask(title, date);
            });
        }

        [tasksOverdue, tasksToday, tasksLater].forEach((el) => {
            if (!el) return;
            el.addEventListener('click', (e) => {
                const done = e.target.closest('.task-item__done');
                if (done) {
                    const checked = !done.closest('.task-item').classList.contains('task-item--done');
                    toggleTask(done.dataset.id, checked);
                    return;
                }
                const del = e.target.closest('.task-item__delete');
                if (del) deleteTask(del.dataset.id);
            });
        });
    }

    bindEvents();
    initSupabase();
})();