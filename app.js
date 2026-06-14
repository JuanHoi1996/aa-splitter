import {
  settle,
  formatCents,
  parseYuanToCents,
} from "./settlement.js";

const STORAGE_KEY = "aa-splitter-groups";

function uid() {
  return crypto.randomUUID();
}

function loadGroups() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveGroups(groups) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
}

const EXAMPLE_GROUP = {
  id: "example",
  name: "ABCDE 周末出游（示例）",
  people: ["A", "B", "C", "D", "E"],
  expenses: [
    {
      id: uid(),
      description: "吃饭",
      amountCents: 10000,
      payer: "A",
      participants: ["A", "B", "C", "D"],
    },
    {
      id: uid(),
      description: "打车",
      amountCents: 10000,
      payer: "B",
      participants: ["B", "C", "D", "E"],
    },
    {
      id: uid(),
      description: "看电影",
      amountCents: 10000,
      payer: "C",
      participants: ["A", "C", "E"],
    },
  ],
};

let groups = loadGroups();
let activeGroupId = groups[0]?.id ?? null;

function getActiveGroup() {
  return groups.find((g) => g.id === activeGroupId) ?? null;
}

function persist() {
  saveGroups(groups);
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function render() {
  const app = document.getElementById("app");
  const group = getActiveGroup();

  app.innerHTML = `
    <header class="header">
      <h1>AA 分账</h1>
      <p class="subtitle">多笔支出 · 净额结算 · 最少转账</p>
    </header>

    <section class="card toolbar">
      <div class="row">
        <label class="label">活动</label>
        <select id="group-select" class="select">
          ${groups.length === 0 ? '<option value="">— 暂无活动 —</option>' : ""}
          ${groups
            .map(
              (g) =>
                `<option value="${g.id}" ${g.id === activeGroupId ? "selected" : ""}>${escapeHtml(g.name)}</option>`
            )
            .join("")}
        </select>
        <button id="btn-new-group" class="btn btn-secondary" type="button">新建</button>
        <button id="btn-delete-group" class="btn btn-danger" type="button" ${!group ? "disabled" : ""}>删除</button>
        <button id="btn-load-example" class="btn btn-secondary" type="button">加载示例</button>
      </div>
    </section>

    ${
      group
        ? `
    <div class="grid">
      <section class="card">
        <h2>人员 <span class="badge">${group.people.length}</span></h2>
        <form id="form-add-person" class="inline-form">
          <input id="input-person" class="input" placeholder="姓名" required maxlength="30" />
          <button class="btn btn-primary" type="submit">添加</button>
        </form>
        <ul class="chip-list" id="people-list">
          ${group.people
            .map(
              (p) => `
            <li class="chip">
              ${escapeHtml(p)}
              <button class="chip-remove" data-person="${escapeHtml(p)}" type="button" title="移除">×</button>
            </li>`
            )
            .join("")}
        </ul>
        ${group.people.length === 0 ? '<p class="hint">先添加参与分账的人员</p>' : ""}
      </section>

      <section class="card">
        <h2>添加支出</h2>
        <form id="form-add-expense" class="form">
          <div class="field">
            <label>描述</label>
            <input id="exp-desc" class="input" placeholder="吃饭、打车…" required maxlength="50" />
          </div>
          <div class="field-row">
            <div class="field">
              <label>金额（元）</label>
              <input id="exp-amount" class="input" type="number" min="0.01" step="0.01" placeholder="100.00" required />
            </div>
            <div class="field">
              <label>付款人</label>
              <select id="exp-payer" class="select" required>
                <option value="">选择付款人</option>
                ${group.people.map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("")}
              </select>
            </div>
          </div>
          <div class="field">
            <label>参与分摊的人</label>
            <div class="checkbox-grid" id="exp-participants">
              ${group.people
                .map(
                  (p) => `
                <label class="checkbox-label">
                  <input type="checkbox" name="participant" value="${escapeHtml(p)}" />
                  ${escapeHtml(p)}
                </label>`
                )
                .join("")}
            </div>
          </div>
          <button class="btn btn-primary" type="submit" ${group.people.length === 0 ? "disabled" : ""}>添加支出</button>
        </form>
      </section>
    </div>

    <section class="card">
      <h2>支出记录 <span class="badge">${group.expenses.length}</span></h2>
      ${
        group.expenses.length === 0
          ? '<p class="hint">暂无支出</p>'
          : `<table class="table">
        <thead>
          <tr><th>描述</th><th>付款人</th><th>参与人</th><th>金额</th><th></th></tr>
        </thead>
        <tbody>
          ${group.expenses
            .map(
              (e) => `
            <tr>
              <td>${escapeHtml(e.description)}</td>
              <td>${escapeHtml(e.payer)}</td>
              <td>${e.participants.map(escapeHtml).join("、")}</td>
              <td class="mono">${formatCents(e.amountCents)}</td>
              <td><button class="btn btn-ghost btn-sm" data-delete-expense="${e.id}" type="button">删除</button></td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>`
      }
    </section>

    ${renderSettlement(group)}
    `
        : '<section class="card empty-state"><p>创建或加载一个活动开始分账</p></section>'
    }
  `;

  bindEvents();
}

function renderSettlement(group) {
  if (group.expenses.length === 0) return "";

  const { balances, transfers } = settle(group.people, group.expenses);
  const allPeople = [...new Set([...group.people, ...Object.keys(balances)])].sort();

  const balanceRows = allPeople
    .filter((p) => balances[p] !== undefined && balances[p] !== 0)
    .map((p) => {
      const c = balances[p];
      const cls = c > 0 ? "positive" : "negative";
      const label = c > 0 ? "应收" : "应付";
      return `<tr><td>${escapeHtml(p)}</td><td class="mono ${cls}">${formatCents(c)}</td><td>${label}</td></tr>`;
    })
    .join("");

  const transferRows = transfers
    .map(
      (t) =>
        `<tr><td>${escapeHtml(t.from)}</td><td>→</td><td>${escapeHtml(t.to)}</td><td class="mono">${formatCents(t.amountCents)}</td></tr>`
    )
    .join("");

  return `
    <section class="card settlement">
      <h2>结算结果</h2>
      <div class="settlement-grid">
        <div>
          <h3>净余额</h3>
          ${
            balanceRows
              ? `<table class="table"><thead><tr><th>人员</th><th>金额</th><th>状态</th></tr></thead><tbody>${balanceRows}</tbody></table>`
              : '<p class="hint">所有人已结清</p>'
          }
        </div>
        <div>
          <h3>最少转账方案 <span class="badge">${transfers.length} 笔</span></h3>
          ${
            transferRows
              ? `<table class="table"><thead><tr><th>付款</th><th></th><th>收款</th><th>金额</th></tr></thead><tbody>${transferRows}</tbody></table>`
              : '<p class="hint">无需转账</p>'
          }
        </div>
      </div>
    </section>`;
}

function bindEvents() {
  document.getElementById("group-select")?.addEventListener("change", (e) => {
    activeGroupId = e.target.value || null;
    render();
  });

  document.getElementById("btn-new-group")?.addEventListener("click", () => {
    const name = prompt("活动名称", "新活动");
    if (!name?.trim()) return;
    const g = { id: uid(), name: name.trim(), people: [], expenses: [] };
    groups.push(g);
    activeGroupId = g.id;
    persist();
    render();
  });

  document.getElementById("btn-delete-group")?.addEventListener("click", () => {
    if (!activeGroupId) return;
    if (!confirm("确定删除此活动？数据不可恢复。")) return;
    groups = groups.filter((g) => g.id !== activeGroupId);
    activeGroupId = groups[0]?.id ?? null;
    persist();
    render();
  });

  document.getElementById("btn-load-example")?.addEventListener("click", () => {
    const g = {
      ...EXAMPLE_GROUP,
      id: uid(),
      expenses: EXAMPLE_GROUP.expenses.map((e) => ({ ...e, id: uid() })),
    };
    groups.push(g);
    activeGroupId = g.id;
    persist();
    render();
  });

  document.getElementById("form-add-person")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const group = getActiveGroup();
    if (!group) return;
    const input = document.getElementById("input-person");
    const name = input.value.trim();
    if (!name) return;
    if (group.people.includes(name)) {
      alert("该人员已存在");
      return;
    }
    group.people.push(name);
    input.value = "";
    persist();
    render();
  });

  document.querySelectorAll(".chip-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      const group = getActiveGroup();
      if (!group) return;
      const person = btn.dataset.person;
      const used = group.expenses.some(
        (e) => e.payer === person || e.participants.includes(person)
      );
      if (used && !confirm(`${person} 出现在支出记录中，确定移除？`)) return;
      group.people = group.people.filter((p) => p !== person);
      persist();
      render();
    });
  });

  document.getElementById("form-add-expense")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const group = getActiveGroup();
    if (!group) return;

    const desc = document.getElementById("exp-desc").value.trim();
    const amountCents = parseYuanToCents(document.getElementById("exp-amount").value);
    const payer = document.getElementById("exp-payer").value;
    const participants = [
      ...document.querySelectorAll('input[name="participant"]:checked'),
    ].map((el) => el.value);

    if (!desc || amountCents === null || amountCents <= 0) {
      alert("请填写有效的描述和金额");
      return;
    }
    if (!payer) {
      alert("请选择付款人");
      return;
    }
    if (participants.length === 0) {
      alert("请至少选择一位参与分摊的人");
      return;
    }

    group.expenses.push({
      id: uid(),
      description: desc,
      amountCents,
      payer,
      participants,
    });
    persist();
    render();
  });

  document.querySelectorAll("[data-delete-expense]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const group = getActiveGroup();
      if (!group) return;
      group.expenses = group.expenses.filter((e) => e.id !== btn.dataset.deleteExpense);
      persist();
      render();
    });
  });
}

render();
