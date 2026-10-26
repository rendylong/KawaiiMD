<script lang="ts">
  import { S } from "../ui-strings";
  import { settings } from "../settings.svelte";
  import { openFile, openFolder } from "../state/app.svelte";
  import { pickFile, pickFolder } from "../fs/tauri";
  import Icon from "./Icon.svelte";

  async function onOpenFile(): Promise<void> {
    const p = await pickFile();
    if (p) await openFile(p);
  }

  async function onOpenFolder(): Promise<void> {
    const p = await pickFolder();
    if (p) await openFolder(p);
  }
</script>

<div class="welcome">
  <div class="w-box">
    <div class="w-logo">{S.appName}</div>
    <div class="w-sub">{S.welcome}</div>
    <div class="w-acts">
      <button type="button" class="pri" onclick={onOpenFile}><Icon name="fileText" /><span>{S.openFile}</span></button>
      <button type="button" onclick={onOpenFolder}><Icon name="folderOpen" /><span>{S.openFolder}</span></button>
    </div>
    {#if settings.recents.length > 0}
      <div class="w-rec">
        <div class="r-h">{S.recent}</div>
        {#each settings.recents as p (p)}
          <button type="button" class="r-i" onclick={() => openFile(p)}>{p}</button>
        {/each}
      </div>
    {/if}
  </div>
</div>
