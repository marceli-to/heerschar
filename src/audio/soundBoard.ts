import { audio } from './engine';

/** Dev page (`?sounds`): one button per sound effect, for auditioning. Each click plays a random variant. */
export function startSoundBoard(root: HTMLElement): void {
  root.innerHTML = '<div style="font:15px system-ui;padding:24px;color:#eee;background:#222;min-height:100vh"><h2>Heerschar sounds</h2><p>Click anywhere first to enable audio. Each button plays a random variant.</p><div id="sb" style="display:flex;flex-wrap:wrap;gap:8px;max-width:900px"></div></div>';
  audio.installUnlock();
  const box = root.querySelector('#sb')!;
  const fill = async (): Promise<void> => {
    await audio.load();
    if (box.childElementCount) return;
    for (const name of audio.names()) {
      const b = document.createElement('button');
      b.textContent = name;
      b.style.cssText = 'padding:8px 12px;font:inherit;cursor:pointer';
      b.onclick = () => audio.play(name, { bus: name.startsWith('ui') ? 'ui' : 'sfx' });
      box.appendChild(b);
    }
  };
  window.addEventListener('pointerdown', () => void fill(), { once: true });
}
