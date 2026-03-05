import { machineReadableSpec } from "@/app/docs/content";
import { CopyForAiButton } from "@/app/docs/copy-for-ai-button";

import styles from "../docs.module.css";

export default function MachineSpecPage() {
  const machineJson = JSON.stringify(machineReadableSpec, null, 2);

  return (
    <section className={styles.section}>
      <div className={styles.heroTop}>
        <h2>Machine Readable Spec</h2>
        <CopyForAiButton endpoint="/api/docs/machine-spec" tip="复制 Machine Readable JSON" />
      </div>
      <p className={styles.summary}>
        AI Agent 可直接读取下方 JSON 进行自动接入。结构版本字段为 <code>docVersion</code>。
        包含认证系统和邀请码系统的完整规范。
      </p>
      <script
        id="base-account-machine-spec"
        type="application/json"
        dangerouslySetInnerHTML={{ __html: machineJson }}
      />
      <details className={styles.fold}>
        <summary>展开查看 Machine Readable JSON</summary>
        <pre data-machine-readable>{machineJson}</pre>
      </details>
    </section>
  );
}
