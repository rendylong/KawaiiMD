<script lang="ts">
  import { S } from "$lib/ui-strings";
  import { setThemeMode, setShowAllFiles, settings, type ThemeMode } from "$lib/settings.svelte";

  const MODES: Array<{ mode: ThemeMode; label: string }> = [
    { mode: "light", label: S.themeLight },
    { mode: "dark", label: S.themeDark },
    { mode: "system", label: S.themeSystem },
  ];
</script>

<!-- 外部点击/ESC 关闭由父级处理（+page 的 svelte:window 监听 + closest 判断） -->
<div class="settings-pop" role="group" aria-label={S.settings}>
  <div class="sp-h">{S.settings}</div>
  <div class="sp-sec">
    <label class="sp-row">
      <span class="sp-l">{S.showAllFiles}<span class="sp-sub">{settings.showAllFiles ? S.showAllOn : S.showAllOff}</span></span>
      <span class="sp-switch">
        <input
          type="checkbox"
          class="sp-input"
          aria-label={S.showAllFiles}
          checked={settings.showAllFiles}
          onchange={(e) => setShowAllFiles(e.currentTarget.checked)}
        /><span class="sp-track"><span class="sp-knob"></span></span>
      </span>
    </label>
  </div>
  <div class="sp-sec">
    <div class="sp-l">{S.appearance}</div>
    <div class="sp-seg" role="group" aria-label={S.appearance}>
      {#each MODES as m (m.mode)}
        <button
          type="button"
          class="sp-seg-btn"
          class:active={settings.themeMode === m.mode}
          aria-pressed={settings.themeMode === m.mode}
          onclick={() => setThemeMode(m.mode)}>{m.label}</button
        >
      {/each}
    </div>
  </div>
</div>
