/**
 * Служебная страница сотрудников «Лиги»: вход через Supabase Auth + обмен файлами.
 *
 * Для работы нужно:
 *  1. Заполнить SUPABASE_URL и SUPABASE_ANON_KEY (ниже).
 *  2. Выполнить supabase-schema.sql в SQL Editor проекта Supabase.
 *  3. Создать пользователей через auth.admin_create_user (см. конец supabase-schema.sql).
 */
(function () {
    'use strict';

    // =============================================================
    // Подключение к Supabase
    // =============================================================
    const SUPABASE_URL = 'https://fmonxvjihcdbeklmwtmm.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_nnM6PLC-FaIBSIVWBPm7aw_eAn3L_ks';

    const BUCKET = 'staff'; // имя bucket-а для файлов (см. supabase-schema.sql)
    // Домен почты по умолчанию: вход по логину превращается в «логин@liga.local»
    const EMAIL_DOMAIN = '@liga.local';

    // Ключ localStorage с датой последнего визита для бейджа «Новый файл»
    const LAST_VISIT_KEY = 'staffLastVisit';

    let supabase = null;
    let currentUserName = 'Сотрудник'; // имя автора для файлов
    let lastLoginErrorText = '';       // последний текст ошибки входа

    // DOM-элементы
    const loginEl = document.getElementById('staffLogin');
    const contentEl = document.getElementById('staffContent');
    const loginForm = document.getElementById('staffLoginForm');
    const loginUser = document.getElementById('staffLoginUser');
    const loginPass = document.getElementById('staffLoginPass');
    const loginError = document.getElementById('staffLoginError');
    const logoutBtn = document.getElementById('staffLogout');
    const userLabel = document.getElementById('staffUserLabel');

    const btnPick = document.getElementById('staffFilePick');
    const fileInput = document.getElementById('staffFileInput');
    const fileListEl = document.getElementById('staffFileList');
    const fileListEmpty = document.getElementById('staffFileListEmpty');

    // ---------------------------------------------------------------
    // Авторизация (Supabase Auth)
    // ---------------------------------------------------------------
    function initSupabase() {
        if (typeof window.supabase === 'undefined') {
            showToast('Библиотека supabase-js не загрузилась. Обновите страницу.', 'error');
            return;
        }
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            showToast('Нет данных для подключения к хранилищу (ключи в staff.js).', 'error');
            return;
        }
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        // Восстанавливаем активную сессию при перезагрузке страницы
        supabase.auth.getSession().then(({ data }) => {
            if (data.session) {
                applySession(data.session);
            } else {
                applySession(null);
            }
        });

        // Следим за изменениями состояния входа (вход/выход)
        supabase.auth.onAuthStateChange((event, session) => {
            applySession(session);
        });
    }

    // Показываем форму входа или рабочую область в зависимости от сессии
    async function applySession(session) {
        const loggedIn = Boolean(session && session.user);
        loginEl.hidden = loggedIn;
        contentEl.hidden = !loggedIn;

        if (loggedIn) {
            currentUserName = await fetchDisplayName(session.user);
            if (userLabel) userLabel.textContent = `Вы вошли как: ${currentUserName}`;
            // Включаем кнопку загрузки и загружаем файлы
            setReady(true);
            await loadFiles();
        } else {
            currentUserName = 'Сотрудник';
        }
    }

    // Полное имя — из таблицы staff_profiles (см. supabase-schema.sql);
    // если профиля нет, показываем логин (часть адреса до @)
    async function fetchDisplayName(user) {
        try {
            const { data, error } = await supabase
                .from('staff_profiles')
                .select('full_name')
                .eq('id', user.id)
                .maybeSingle();
            if (!error && data && data.full_name) return data.full_name;
        } catch (e) {
            // игнорируем и подставляем логин
        }
        return (user.email || '').split('@')[0] || 'Сотрудник';
    }

    function showLoginError(message) {
        if (loginError) {
            const icon = loginError.querySelector('i');
            if (icon) icon.remove();
            loginError.textContent = message || 'Неверный логин или пароль.';
            loginError.hidden = false;
        }
    }

    function signIn() {
        if (!supabase) return;
        const raw = (loginUser.value || '').trim();
        if (!raw) return;
        // Подставляем домен, если введён только логин («afilin» → «afilin@liga.local»)
        const email = raw.includes('@') ? raw : raw + EMAIL_DOMAIN;
        attemptSignIn(email, loginPass.value || '');
    }

    function isNetworkError(message) {
        return /load failed|failed to fetch|network|fetch/i.test(message || '');
    }

    // Пробуем войти; при сбое сети делаем несколько повторных попыток
    function attemptSignIn(email, password, attempt) {
        attempt = attempt || 1;
        supabase.auth.signInWithPassword({ email, password })
            .then(({ error }) => {
                if (error) {
                    // Кратковременный сбой сети — пробуем снова
                    if (isNetworkError(error.message) && attempt < 3) {
                        setTimeout(() => attemptSignIn(email, password, attempt + 1), 800);
                        return;
                    }
                    onceAfterNetworkError(showLoginError, describeError(error));
                } else {
                    if (loginError) loginError.hidden = true;
                    loginUser.value = '';
                    loginPass.value = '';
                }
            })
            .catch((err) => {
                if (isNetworkError(err && err.message) && attempt < 3) {
                    setTimeout(() => attemptSignIn(email, password, attempt + 1), 800);
                    return;
                }
                onceAfterNetworkError(showLoginError, (err && err.message) || 'Сбой при подключении к серверу входа.');
            });
    }

    function describeError(error) {
        const code = error.code || '';
        const msg = error.message || '';
        if (code === 'invalid_credentials' || /invalid login credentials/i.test(msg)) {
            return 'Неверный логин или пароль. Проверьте написание (логин — «afilin» или «afilin@liga.local»).';
        }
        if (code === 'email_not_confirmed' || /email not confirmed/i.test(msg)) {
            return 'Адрес не подтверждён. Подтвердите пользователя в панели Supabase (Authentication → Users) или выполните SQL из инструкции.';
        }
        if (code === 'user_banned') {
            return 'Этот пользователь заблокирован в панели Supabase.';
        }
        if (code === 'over_email_send_rate_limit') {
            return 'Слишком много попыток подряд. Подождите минуту и повторите.';
        }
        if (isNetworkError(msg)) {
            return 'Нет связи с сервером входа. Проверьте интернет и нажмите «Войти» ещё раз.';
        }
        return msg || 'Не удалось выполнить вход.';
    }

    // Показываем сообщение об ошибке, не перезатирая понятный текст сети
    function onceAfterNetworkError(fn, text) {
        if (!/нет связи с сервером входа/i.test(lastLoginErrorText)) {
            lastLoginErrorText = text;
            fn(text);
        }
    }

    function signOut() {
        if (!supabase) return;
        supabase.auth.signOut().catch(() => {
            // даже при ошибке выхода скрываем рабочую область
            loginEl.hidden = false;
            contentEl.hidden = true;
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            signIn();
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', signOut);
    }

    // ---------------------------------------------------------------
    // Подключение к Supabase (таблицы/файлы)
    // ---------------------------------------------------------------
    function setReady(ready) {
        if (btnPick) btnPick.disabled = !ready;
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
                        <div class="staff-file__name">${escapeHtml(file.name)}${isNew ? ' <span class="staff-file__badge">Новый' : ''}${isNew ? '</span>' : ''}</div>
                        <div class="staff-file__meta">
                            <span class="staff-file__count">Скачано: ${Number(file.download_count || 0)}</span>
                            <span class="staff-file__author">${escapeHtml(file.author || 'Сотрудник')}</span>
                        </div>
                    </div>
                    <div class="staff-file__actions">
                        <button type="button" class="btn btn--small btn--outline btn--download" data-path="${escapeHtml(file.storage_path)}" data-name="${escapeHtml(file.name)}" data-id="${file.id}">
                            <i class="fas fa-download"></i> Скачать
                        </button>
                        <button type="button" class="staff-file__delete" data-id="${file.id}" title="Удалить файл" aria-label="Удалить файл">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>`;
                fileListEl.appendChild(li);
            });

            // Новая дата последнего визита — «новизна» сохранится лишь до следующего визита
            localStorage.setItem(LAST_VISIT_KEY, String(now));
        } catch (err) {
            showToast(`Ошибка загрузки списка файлов: ${err.message || err}`, 'error');
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
                    author: currentUserName,
                    storage_path: storagePath,
                    file_type: file.type || null
                });
                if (dbError) throw dbError;
            } catch (err) {
                showToast(`Не удалось загрузить «${file.name}»: ${err.message}.`, 'error');
                return;
            }
        }
        fileInput.value = '';
        loadFiles();
    }

    function downloadFile(path, name, id) {
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

                // Увеличиваем счётчик «Скачано» (без перезагрузки списка)
                if (id) {
                    const countEl = fileListEl.querySelector(`[data-id="${id}"] .staff-file__count`);
                    if (countEl) {
                        const next = Number((countEl.textContent.match(/\d+/) || [0])[0]) + 1;
                        countEl.textContent = `Скачано: ${next}`;
                    }
                    supabase.from('staff_files').select('download_count').eq('id', id).maybeSingle()
                        .then(({ data: row, error: rErr }) => {
                            if (rErr || !row) return;
                            supabase.from('staff_files')
                                .update({ download_count: Number(row.download_count || 0) + 1 })
                                .eq('id', id);
                        })
                        .catch(() => {});
                }
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
                downloadFile(dl.dataset.path, dl.dataset.name, dl.dataset.id);
                return;
            }
            const del = e.target.closest('.staff-file__delete');
            if (del) deleteFile(del.dataset.id);
        });
    }

    bindEvents();
    initSupabase();
})();