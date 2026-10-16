
const SUPABASE_URL = "https://psricifqrvqzoxbauvoy.supabase.co";
const SUPABASE_KEY = "sb_publishable_NKOUaP0dwip2-2bmlTnSxA_TbXblN8u";
const BUCKET = "mediaspace";

const ADMIN_EMAILS = ["isakaevalihan6@gmail.com"];

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const gallery = document.getElementById("galleryList");
const search = document.getElementById("search");
const loginForm = document.getElementById("loginForm");
const adminPanel = document.getElementById("adminPanel");
const adminStatus = document.getElementById("adminStatus");
const fileInput = document.getElementById("fileInput");
const fileTitle = document.getElementById("fileTitle");
const message = document.getElementById("message");
const uploadButton = document.getElementById("uploadButton");

const subscribeModal = document.getElementById("subscribeModal");
const continueDownload = document.getElementById("continueDownload");
const closeModal = document.getElementById("closeModal");

const adminModal = document.getElementById("admin");
const adminOpenBtn = document.getElementById("adminOpenBtn");
const adminCloseBtn = document.getElementById("adminCloseBtn");

let files = [];
let selectedType = "all";
let pendingDownload = null;

function isAdmin(user) {
  return Boolean(
    user?.email &&
    ADMIN_EMAILS.includes(user.email.toLowerCase())
  );
}

function setMessage(text) {
  message.textContent = text;
}

function getFileInfo(object) {
  const parts = object.name.split("__");

  const originalName = parts.length >= 3
    ? parts.slice(2).join("__")
    : object.name;

  const title = parts.length >= 3
    ? parts[1].replace(/_/g, " ")
    : originalName.replace(/\.[^.]+$/, "");

  const mime = object.metadata?.mimetype || "";
  const ext = originalName.split(".").pop().toLowerCase();

  const isVideo = mime.startsWith("video/") ||
    ["mp4", "webm", "mov", "m4v", "ogv"].includes(ext);

  const isImage = mime.startsWith("image/") ||
    ["jpg", "jpeg", "png", "gif", "webp", "avif", "bmp"].includes(ext);

  if (!isVideo && !isImage) return null;

  const { data } = db.storage.from(BUCKET).getPublicUrl(object.name);

  return {
    name: originalName,
    title,
    path: object.name,
    url: data.publicUrl,
    type: isVideo ? "video" : "image"
  };
}

async function loadFiles() {
  gallery.replaceChildren();

  const { data, error } = await db.storage
    .from(BUCKET)
    .list("", {
      limit: 1000,
      sortBy: { column: "created_at", order: "desc" }
    });

  if (error) {
    gallery.textContent = "Не удалось загрузить галерею. Проверь настройки Storage.";
    console.error(error);
    return;
  }

  files = (data || [])
    .filter(item => item.name && item.name !== ".emptyFolderPlaceholder")
    .map(getFileInfo)
    .filter(Boolean);

  render();
}

function render() {
  const query = search.value.trim().toLowerCase();

  const filtered = files.filter(file => {
    const matchesType =
      selectedType === "all" || file.type === selectedType;

    const matchesSearch =
      file.title.toLowerCase().includes(query) ||
      file.name.toLowerCase().includes(query);

    return matchesType && matchesSearch;
  });

  gallery.replaceChildren();

  if (filtered.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "Файлов пока нет.";
    gallery.appendChild(empty);
    return;
  }

  filtered.forEach(file => {
    const card = document.createElement("article");
    card.className = "card";

    let preview;

    if (file.type === "image") {
      preview = document.createElement("img");
      preview.alt = file.title;
      preview.loading = "lazy";
    } else {
      preview = document.createElement("video");
      preview.controls = true;
      preview.preload = "metadata";
      preview.playsInline = true;
    }

    preview.src = file.url;
    preview.className = "preview";

    const content = document.createElement("div");
    content.className = "card-content";

    const type = document.createElement("span");
    type.className = "type";
    type.textContent = file.type === "image" ? "ФОТО" : "ВИДЕО";

    const title = document.createElement("h3");
    title.textContent = file.title;

    const download = document.createElement("button");
    download.className = "download";
    download.type = "button";
    download.textContent = "Скачать ↓";

    download.addEventListener("click", () => {
      requestDownload(file);
    });

    content.append(type, title, download);

    if (!adminPanel.hidden) {
      const remove = document.createElement("button");
      remove.className = "delete-button";
      remove.type = "button";
      remove.textContent = "Удалить";
      remove.addEventListener("click", () => deleteFile(file));
      content.appendChild(remove);
    }

    card.append(preview, content);
    gallery.appendChild(card);
  });
}

// Окно подписки

function requestDownload(file) {
  pendingDownload = file;
  subscribeModal.classList.add("show");
}

function hideSubscribeModal() {
  subscribeModal.classList.remove("show");
}

function downloadFile(file) {
  const link = document.createElement("a");
  link.href = file.url + "?download=" + encodeURIComponent(file.name);
  link.download = file.name;
  link.target = "_blank";
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

continueDownload.addEventListener("click", () => {
  if (!pendingDownload) {
    hideSubscribeModal();
    return;
  }

  const file = pendingDownload;
  pendingDownload = null;

  hideSubscribeModal();
  downloadFile(file);
});

closeModal.addEventListener("click", () => {
  pendingDownload = null;
  hideSubscribeModal();
});

subscribeModal.addEventListener("click", event => {
  if (event.target === subscribeModal) {
    pendingDownload = null;
    hideSubscribeModal();
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    pendingDownload = null;
    hideSubscribeModal();
    adminModal.classList.remove("show");
  }
});

// Вход администратора

loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  setMessage("Выполняется вход...");

  const email = document.getElementById("adminEmail").value.trim();
  const password = document.getElementById("adminPassword").value;

  const { data, error } = await db.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    setMessage("Не удалось войти. Проверь email и пароль.");
    console.error(error);
    return;
  }

  if (!isAdmin(data.user)) {
    await db.auth.signOut();
    setMessage("Этот аккаунт не добавлен в список администраторов.");
    return;
  }

  showAdmin(data.user);
  adminModal.classList.remove("show");
  setMessage("Ты вошёл как администратор.");
});

function showAdmin(user) {
  loginForm.hidden = true;
  adminPanel.hidden = false;
  adminStatus.textContent = "Вход выполнен: " + user.email;
  render();
}

function showVisitor() {
  loginForm.hidden = false;
  adminPanel.hidden = true;
  adminStatus.textContent = "";
  render();
}

document.getElementById("logoutButton").addEventListener("click", async () => {
  const { error } = await db.auth.signOut();

  if (error) {
    setMessage("Не удалось выйти.");
    return;
  }

  showVisitor();
  setMessage("Ты вышел из аккаунта.");
});

// Загрузка файлов

uploadButton.addEventListener("click", async () => {
  const { data: sessionData } = await db.auth.getSession();
  const user = sessionData.session?.user;

  if (!isAdmin(user)) {
    setMessage("Сначала войди в аккаунт администратора.");
    return;
  }

  const selectedFiles = Array.from(fileInput.files);

  if (!selectedFiles.length) {
    setMessage("Сначала выбери фотографии или видео.");
    return;
  }

  const titlePrefix = fileTitle.value.trim()
    .replace(/[\/\\:*?"<>|]/g, "")
    .replace(/__/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 80);

  uploadButton.disabled = true;
  let uploaded = 0;

  try {
    for (const file of selectedFiles) {
      if (
        !file.type.startsWith("image/") &&
        !file.type.startsWith("video/")
      ) {
        continue;
      }

      const safeName = file.name
        .replace(/[\/\\:*?"<>|]/g, "_")
        .replace(/__/g, "_");

      const title = titlePrefix ||
        file.name.replace(/\.[^.]+$/, "").slice(0, 80);

      const path = `${Date.now()}_${uploaded}__${title}__${safeName}`;

      const { error } = await db.storage.from(BUCKET).upload(path, file, {
        contentType: file.type,
        upsert: false
      });

      if (error) throw error;
      uploaded++;
    }

    setMessage(`Загружено файлов: ${uploaded}.`);
    fileInput.value = "";
    fileTitle.value = "";
    await loadFiles();
  } catch (error) {
    console.error(error);
    setMessage("Ошибка загрузки. Проверь права доступа и размер файла.");
  } finally {
    uploadButton.disabled = false;
  }
});

// Удаление файлов

async function deleteFile(file) {
  const { data: sessionData } = await db.auth.getSession();

  if (!isAdmin(sessionData.session?.user)) {
    setMessage("Нет доступа к удалению.");
    return;
  }

  if (!confirm(`Удалить файл «${file.name}»?`)) return;

  const { error } = await db.storage.from(BUCKET).remove([file.path]);

  if (error) {
    setMessage("Не удалось удалить файл.");
    console.error(error);
    return;
  }

  setMessage("Файл удалён.");
  await loadFiles();
}

// Фильтры и поиск

document.querySelectorAll(".filter").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".filter").forEach(item => {
      item.classList.remove("active");
    });

    button.classList.add("active");
    selectedType = button.dataset.type;
    render();
  });
});

search.addEventListener("input", render);

// Окно администратора

adminOpenBtn.addEventListener("click", () => {
  adminModal.classList.add("show");
});

adminCloseBtn.addEventListener("click", () => {
  adminModal.classList.remove("show");
});

adminModal.addEventListener("click", event => {
  if (event.target === adminModal) {
    adminModal.classList.remove("show");
  }
});

// Запуск сайта

async function startApp() {
  const { data, error } = await db.auth.getSession();

  if (error) console.error(error);

  if (data.session && isAdmin(data.session.user)) {
    showAdmin(data.session.user);
  } else {
    showVisitor();
  }

  await loadFiles();
}

startApp();
