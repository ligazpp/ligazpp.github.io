/**
 * Служебная страница сотрудников «Лиги»: обмен файлами.
 *
 * Чтобы заработало, нужно заполнить ключи подключения к Supabase
 * (см. константы SUPABASE_URL и SUPABASE_ANON_KEY ниже) и выполнить
 * скрипт supabase-schema.sql из корня сайта в SQL Editor проекта Supabase.
 */
(function () {
    'use strict';

    // =============================================================
    // Подключение к Supabase (заполнено):
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

    // Ключ sessionStorage с именем вошедшего сотрудника
    const SESSION_USER_KEY = 'staffUser';

    let supabase = null;

    // DOM-элементы
    const loginEl = document.getElementById('staffLogin');
    const contentEl = document.getElementById('staffContent');
    const loginForm = document.getElementById('staffLoginForm');
    const loginUser = document.getElementById('staffLoginUser');
    const loginPass = document.getElementById('staffLoginPass');
    const loginError = document.getElementById('staffLoginError');
    const logoutBtn = document.getElementById('staffLogout');
    const userLabel = document.getElementById('staffUserLabel');

    const statusEl = document.getElementById('staffStatus');
    const statusText = document.getElementById('staffStatusText');
    const btnPick = document.getElementById('staffFilePick');
    const fileInput = document.getElementById('staffFileInput');
    const fileListEl = document.getElementById('staffFileList');
    const fileListEmpty = document.getElementById('staffFileListEmpty');

    // ---------------------------------------------------------------
    // Вход / выход
    // ---------------------------------------------------------------
    function currentUser() {
        return JSON.parse(sessionStorage.getItem(SESSION_USER_KEY) || 'null');
    }

    function renderAuth() {
        const user = currentUser();
        const loggedIn = Boolean(user);
        loginEl.hidden = loggedIn;
        contentEl.hidden = !loggedIn;

        if (user && userLabel) {
            userLabel.textContent = `Вы вошли как: ${user.name}`;
        }

        if (loggedIn) {
            initSupabase();
        }
    }

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const login = (loginUser.value || '').trim().toLowerCase();
            const password = loginPass.value || '';
            const found = (window.STAFF_USERS || []).find(
                (u) => u.login.toLowerCase() === login && u.password === password
            );
            if (found) {
                sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify({ name: found.name, role: found.role }));
                loginError.hidden = true;
                loginUser.value = '';
                loginPass.value = '';
                renderAuth();
            } else {
                loginError.hidden = false;
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            sessionStorage.removeItem(SESSION_USER_KEY);
            renderAuth();
        });
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
            setStatus(STATUS_OK, 'Хранилище подключено. Можно обмениваться файлами.');
            setReady(true);
            loadFiles();
        } catch (err) {
            setStatus(
                STATUS_ERROR,
                `Не удалось подключиться к хранилищу: ${err.message || err}. Проверьте ключи в staff.js и выполните supabase-schema.sql.`
            );
        }
    }

    // ---------------------------------------------------------------
    // Вспомогательные функции
    // ---------------------------------------------------------------
    function setStatus(state, message) {
        statusEl.dataset.state = state;
        statusText.textContent = message;
    }

    function setReady(ready) {
        if (btnPick) btnPick.disabled = !ready;
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
            // В названии файла в хранилище не должно быть кириллицы и пробелов —
            // Supabase Storage их отвергает. Генерируем безопасное имя (дата + счётчик),
            // а красивое имя файла храним в таблице staff_files и подставляем при скачивании.
            const safeExt = (file.name.match(/\.[a-zA-Z0-9]{1,10}$/) || [''])[0];
            const storagePath = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${safeExt}`;
            const user = currentUser();
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
                    author: user ? user.name : 'Сотрудник',
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
    }

    function downloadFile(path, name) {
        (async () => {
            try {
                // Скачиваем через download() — браузер вернёт blob,
                // и мы сохраним файл под его исходным именем.
                const { data, error } = await supabase.storage.from(BUCKET).download(path);
                if (error) throw error;
                const url = URL.createObjectURL(data);
                const a = document.createElement('a');
                a.href = url;
                a.download = name || path;
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
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
    // События интерфейса
    // ---------------------------------------------------------------
    function bindEvents() {
        if (btnPick && fileInput) {
            btnPick.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', () => uploadFiles(fileInput.files));
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
    }

    bindEvents();
    renderAuth();
})();