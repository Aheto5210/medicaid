import { apiFetch } from '../api.js';

function parseFilename(contentDisposition, fallbackFilename) {
  const header = String(contentDisposition || '');
  const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const basicMatch = header.match(/filename="?([^"]+)"?/i);
  if (basicMatch?.[1]) {
    return basicMatch[1];
  }

  return fallbackFilename;
}

async function saveWithBrowser(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
    link.remove();
  }, 1500);
}

async function saveWithTauri(blob, filename) {
  const { isTauri } = await import('@tauri-apps/api/core');

  if (!isTauri()) {
    await saveWithBrowser(blob, filename);
    return { cancelled: false };
  }

  const [{ save }, { writeFile }] = await Promise.all([
    import('@tauri-apps/plugin-dialog'),
    import('@tauri-apps/plugin-fs')
  ]);

  const targetPath = await save({
    defaultPath: filename
  });

  if (!targetPath) {
    return { cancelled: true };
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  await writeFile(targetPath, bytes);
  return { cancelled: false, path: targetPath };
}

export async function downloadFile(path, fallbackFilename) {
  const response = await apiFetch(path);

  if (!response.ok) {
    let message = 'Download failed. Please try again.';

    try {
      const data = await response.json();
      if (data?.message) {
        message = data.message;
      }
    } catch {
      // Ignore non-JSON download errors.
    }

    throw new Error(message);
  }

  const filename = parseFilename(
    response.headers.get('content-disposition'),
    fallbackFilename
  );
  const blob = await response.blob();
  const result = await saveWithTauri(blob, filename);

  return {
    ...result,
    filename
  };
}
