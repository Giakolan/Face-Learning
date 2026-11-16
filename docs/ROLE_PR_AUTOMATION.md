# 角色分支的 PR 自動檢查與整合

## 試跑唯讀檢查

將這輪程式碼審查合入 `main` 後，從 GitHub Actions 開啟 **Audit role pull request → Run workflow**，選 `main` 並填入 PR 編號。檢查只讀取作者、Git refs 與檔名差異。執行紀錄會列出被檢查的 `main`、目標分支、PR head SHA 和檔案。

目前試跑名單依歷史 PR 設定，B 為 `liupiyan`、C 為 `bugtail`、D 為 `Giakolan`、E 為 `uhumipaa`、F 為 `cloud-sky-0128`。D、E 的路徑來自 [PR #12](https://github.com/heetah/Face-Learning/pull/12) 和 [PR #13](https://github.com/heetah/Face-Learning/pull/13)。正式啟用前須由維護者確認帳號、分支和可修改的檔案。未設定的帳號會被拒絕，`heetah` 跳過組員規則。新增檔案或跨角色變更先由維護者確認範圍。

## 第一階段：組員 PR → 角色分支

- PR 的 GitHub base 是角色分支。最新 `upstream/main` 則是 PR head 必須包含的 Git 提交。目標角色分支也須同步該提交，讓 diff 以共用整合版本為準。
- 依 PR 作者核對角色分支和可修改檔案。重新命名會核對舊、新兩個路徑。GitHub 上的角色分支需禁止可繞過檢查的直接推送。
- 正式版由受信任的 GitHub App 或等效服務在開啟 PR、推送更新、改 base 或重開時執行，將結果回報到實際 PR head。規則要求由該來源回報成功。合併前重新核對三個 SHA，因為 `main` 或角色分支可能在檢查之後更新。

## 第二階段：角色分支 → main

- 確認角色 PR 合併後，由 bot 從當時最新的 `main` 建立整合分支，只帶入該次已驗證的改動。舊角色分支可能有自己的 README、AGENTS 和圖檔。先確認整合分支的 diff，避免把歷史內容順帶放進 `main`。
- bot 開 PR 到 `main`。先重跑路徑檢查並執行適用的合成測試，再透過 GitHub Auto-merge 或 merge queue 合併。整合工作依序處理，合併衝突、測試失敗或 `main` 移動時重新驗證。
- 正式自動合併需要在 repo 設定保護規則、必要的檢查，以及 GitHub App 的最小寫入權限。具備寫入權限的流程只操作可信的 refs 和 GitHub metadata。合成測試在隔離 runner 執行，使用唯讀權限與合成資料。

本輪只提供唯讀試跑。自動觸發、實際合併和規則設定須在確認帳號、路徑與測試環境後配置。
