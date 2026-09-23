const templateMap = {
  shipping: {
    label: "发货",
    name: "发货资料模板",
    icon: "↗",
    description: "用于设备、备件等发货环节的资料归集",
    assets: [
      { name:"发货清单模板.docx", size:"42 KB", source:"demo" },
      { name:"客户签收单模板.docx", size:"38 KB", source:"demo" },
      { name:"设备发货明细.xlsx", size:"26 KB", source:"demo" }
    ],
    files: [
      ["发货清单", "记录设备名称、数量及序列号", ["prepared", "filled", "signed", "archived"]],
      ["客户签收单", "由客户确认收货并签字", ["prepared", "filled", "signed", "archived"]],
      ["物流凭证", "快递面单或物流交接凭证", ["prepared", "archived"]],
      ["设备照片", "装箱前及包装完成后的照片", ["prepared", "archived"]]
    ]
  },
  receiving: {
    label: "收货",
    name: "收货资料模板",
    icon: "↙",
    description: "用于设备到货验收及异常记录",
    assets: [
      { name:"收货登记表.xlsx", size:"31 KB", source:"demo" },
      { name:"到货验收单.docx", size:"45 KB", source:"demo" },
      { name:"异常情况记录表.docx", size:"29 KB", source:"demo" }
    ],
    files: [
      ["收货登记表", "登记到货时间和物品明细", ["prepared", "filled", "signed", "archived"]],
      ["到货验收单", "核对数量、外观及包装情况", ["prepared", "filled", "signed", "archived"]],
      ["异常情况记录", "存在破损或差异时填写", ["prepared", "filled", "archived"]]
    ]
  },
  training: {
    label: "培训",
    name: "培训资料模板",
    icon: "◇",
    description: "用于现场培训及参训人员确认",
    assets: [
      { name:"培训计划模板.docx", size:"36 KB", source:"demo" },
      { name:"培训签到表.xlsx", size:"24 KB", source:"demo" },
      { name:"培训记录模板.docx", size:"41 KB", source:"demo" }
    ],
    files: [
      ["培训计划", "说明时间、地点和培训内容", ["prepared", "filled", "archived"]],
      ["培训签到表", "参训人员现场签字", ["prepared", "filled", "signed", "archived"]],
      ["培训记录", "记录培训内容和完成情况", ["prepared", "filled", "signed", "archived"]],
      ["现场照片", "培训过程照片", ["prepared", "archived"]]
    ]
  }
};

const uploadedTemplateFiles = new Map();
const initialTemplateAssets = Object.fromEntries(Object.keys(templateMap).map(function (type) {
  return [type, structuredClone(templateMap[type].assets)];
}));
let selectedDirectoryHandle = null;

function createFiles(type, presets) {
  return templateMap[type].files.map(function (row, index) {
    const file = {
      name: row[0],
      note: row[1],
      required: row[2],
      prepared: row[2].includes("prepared") ? "pending" : "na",
      filled: row[2].includes("filled") ? "pending" : "na",
      signed: row[2].includes("signed") ? "pending" : "na",
      archived: row[2].includes("archived") ? "pending" : "na",
      attachment: ""
    };
    return Object.assign(file, presets && presets[index] ? presets[index] : {});
  });
}

const seedProjects = [
  {
    id: 1, code: "WP-2026-018", name: "华东智造产线升级项目", customer: "华东智造有限公司",
    contact: "王工 · 138 0000 6821", owner: "陈佳", templates: ["shipping", "receiving", "training"],
    folder: "D:\\项目资料\\华东智造产线升级项目", importedFiles: 9,
    note: "二期自动化产线设备交付及人员培训",
    events: [
      { id: 101, type: "shipping", name: "第一批控制柜发货", date: "2026-09-18", owner: "陈佳",
        files: createFiles("shipping", [
          { prepared:"done", filled:"done", signed:"pending", archived:"pending", attachment:"发货清单_第一批.pdf" },
          { prepared:"done", filled:"done", signed:"pending", archived:"pending", attachment:"客户签收单.pdf" },
          { prepared:"done", archived:"done", attachment:"物流凭证.jpg" },
          { prepared:"done", archived:"done", attachment:"装箱照片.zip" }
        ]) },
      { id: 102, type: "training", name: "设备操作培训", date: "2026-09-28", owner: "林晓",
        files: createFiles("training", [
          { prepared:"done", filled:"done", archived:"pending", attachment:"培训计划.docx" }
        ]) }
    ]
  },
  {
    id: 2, code: "WP-2026-016", name: "瑞科实验室设备交付", customer: "瑞科检测技术有限公司",
    contact: "刘经理 · 139 0000 3018", owner: "林晓", templates: ["shipping", "training"],
    folder: "D:\\项目资料\\瑞科实验室设备交付", importedFiles: 6,
    note: "视觉检测平台交付及使用培训",
    events: [
      { id: 201, type: "shipping", name: "视觉检测平台发货", date: "2026-09-12", owner: "林晓",
        files: createFiles("shipping", [
          { prepared:"done", filled:"done", signed:"done", archived:"done", attachment:"发货清单.pdf" },
          { prepared:"done", filled:"done", signed:"done", archived:"done", attachment:"签收单.pdf" },
          { prepared:"done", archived:"done", attachment:"物流凭证.jpg" },
          { prepared:"done", archived:"done", attachment:"设备照片.zip" }
        ]) },
      { id: 202, type: "training", name: "平台使用培训", date: "2026-09-20", owner: "陈佳",
        files: createFiles("training", [
          { prepared:"done", filled:"done", archived:"done", attachment:"培训计划.pdf" },
          { prepared:"done", filled:"done", signed:"done", archived:"done", attachment:"签到表.pdf" },
          { prepared:"done", filled:"done", signed:"done", archived:"pending", attachment:"培训记录.pdf" },
          { prepared:"done", archived:"pending", attachment:"现场照片.zip" }
        ]) }
    ]
  },
  {
    id: 3, code: "WP-2026-012", name: "北辰自动化培训支持", customer: "北辰自动化科技有限公司",
    contact: "赵主管 · 137 0000 5569", owner: "周远", templates: ["training"],
    folder: "D:\\项目资料\\北辰自动化培训支持", importedFiles: 3,
    note: "面向工程团队的设备调试与维护培训",
    events: [
      { id: 301, type:"training", name:"设备维护培训", date:"2026-09-08", owner:"周远",
        files: createFiles("training", [
          { prepared:"done", filled:"done", archived:"done", attachment:"培训计划.pdf" },
          { prepared:"done", filled:"done", signed:"done", archived:"done", attachment:"培训签到表.pdf" },
          { prepared:"done", filled:"done", signed:"done", archived:"done", attachment:"培训记录.pdf" },
          { prepared:"done", archived:"done", attachment:"培训照片.zip" }
        ]) }
    ]
  },
  {
    id: 4, code: "WP-2026-021", name: "远航仓储设备收货", customer: "远航物流有限公司",
    contact: "徐工 · 136 0000 8871", owner: "陈佳", templates: ["receiving"],
    folder: "D:\\项目资料\\远航仓储设备收货", importedFiles: 3,
    note: "仓储机器人到货验收",
    events: [
      { id: 401, type:"receiving", name:"仓储机器人收货", date:"2026-09-22", owner:"陈佳",
        files: createFiles("receiving", [
          { prepared:"done", filled:"done", signed:"done", archived:"pending", attachment:"收货登记表.pdf" },
          { prepared:"done", filled:"pending", signed:"pending", archived:"pending", attachment:"到货验收单.docx" },
          { prepared:"done", filled:"pending", archived:"pending" }
        ]) }
    ]
  }
];

let appState = {
  view: "home",
  projects: structuredClone(seedProjects),
  selectedProjectId: null,
  projectTab: "events",
  projectFilter: "all",
  pendingFilter: "all",
  search: ""
};

const viewNode = document.querySelector("#view");
const breadcrumbNode = document.querySelector("#breadcrumb");
const modalNode = document.querySelector("#modalRoot");
const toastNode = document.querySelector("#toastRoot");

function allEvents() {
  return appState.projects.flatMap(function (project) {
    return project.events.map(function (event) {
      return { event: event, project: project };
    });
  });
}

function eventProgress(event) {
  const values = event.files.flatMap(function (file) {
    return ["prepared", "filled", "signed", "archived"]
      .filter(function (step) { return file[step] !== "na"; })
      .map(function (step) { return file[step]; });
  });
  const done = values.filter(function (value) { return value === "done"; }).length;
  return { done: done, total: values.length, percent: values.length ? Math.round(done / values.length * 100) : 100 };
}

function pendingFiles() {
  return allEvents().flatMap(function (pair) {
    return pair.event.files.flatMap(function (file) {
      const gaps = [];
      if (!file.attachment) gaps.push("未上传");
      if (file.prepared === "pending") gaps.push("待准备");
      if (file.filled === "pending") gaps.push("待填写");
      if (file.signed === "pending") gaps.push("待签字");
      if (file.archived === "pending") gaps.push("待归档");
      return gaps.length ? [{ file:file, gaps:gaps, event:pair.event, project:pair.project }] : [];
    });
  });
}

function formatDate(value) {
  if (!value) return "未设置日期";
  const parts = value.split("-");
  return Number(parts[1]) + "月" + Number(parts[2]) + "日";
}

function progressBar(percent) {
  return '<div class="progress-track"><div class="progress-fill" style="width:' + percent + '%"></div></div>';
}

function typeTag(type) {
  const classMap = { shipping:"orange", receiving:"blue", training:"green" };
  return '<span class="tag ' + classMap[type] + '">' + templateMap[type].label + '</span>';
}

function heading(eyebrow, title, subtitle, actions) {
  return '<div class="page-heading"><div><p class="eyebrow">' + eyebrow + '</p><h1>' + title +
    '</h1><p>' + subtitle + '</p></div><div class="heading-actions">' + (actions || "") + '</div></div>';
}

function setBreadcrumb(parts) {
  breadcrumbNode.innerHTML = parts.map(function (part, index) {
    return index === parts.length - 1 ? "<strong>" + part + "</strong>" : "<span>" + part + "</span>";
  }).join("　›　");
}

function toast(message) {
  toastNode.innerHTML = '<div class="toast">' + message + '</div>';
  window.setTimeout(function () { toastNode.innerHTML = ""; }, 2200);
}

function render() {
  document.querySelectorAll(".nav button").forEach(function (button) {
    button.classList.toggle("active", button.dataset.view === appState.view);
  });
  document.querySelector("#navPending").textContent = pendingFiles().length;
  if (appState.view === "home") renderHome();
  if (appState.view === "projects") renderProjects();
  if (appState.view === "project") renderProject();
  if (appState.view === "pending") renderPending();
  if (appState.view === "templates") renderTemplates();
}

function renderHome() {
  setBreadcrumb(["工作台"]);
  const pending = pendingFiles();
  const events = allEvents().sort(function (a,b) { return b.event.date.localeCompare(a.event.date); });
  const activeProjects = appState.projects.filter(function (project) {
    return project.events.some(function (event) { return eventProgress(event).percent < 100; });
  });
  const openEvents = events.filter(function (pair) { return eventProgress(pair.event).percent < 100; });
  let notices = pending.slice(0, 5).map(function (item) {
    return '<li class="notice-item"><span class="notice-icon ' + (item.file.attachment ? "" : "missing") + '">' +
      (item.file.attachment ? "✎" : "▱") + '</span><span class="notice-text"><strong>' + item.file.name +
      '</strong><span>' + item.project.name + ' · ' + item.event.name + '</span></span><span class="tag ' +
      (item.gaps.includes("待签字") ? "orange" : "gray") + '">' + item.gaps[0] +
      '</span><button aria-label="查看事项" data-open-event="' + item.event.id + '" data-project="' + item.project.id + '">›</button></li>';
  }).join("");
  let projectProgress = appState.projects.slice(0, 4).map(function (project) {
    const totals = project.events.reduce(function (sum,event) { return sum + eventProgress(event).total; }, 0);
    const done = project.events.reduce(function (sum,event) { return sum + eventProgress(event).done; }, 0);
    const percent = totals ? Math.round(done / totals * 100) : 0;
    return '<div class="progress-row"><div class="progress-label"><strong>' + project.name + '</strong><span>' + percent +
      '%</span></div>' + progressBar(percent) + '<div class="progress-meta">' + project.events.length +
      ' 个业务事项 · 负责人 ' + project.owner + '</div></div>';
  }).join("");
  let recentRows = events.slice(0, 4).map(function (pair) {
    const progress = eventProgress(pair.event);
    return '<tr><td class="name-cell"><strong>' + pair.event.name + '</strong><small>' + pair.event.files.length +
      ' 份文件</small></td><td>' + pair.project.name + '</td><td>' + typeTag(pair.event.type) + '</td><td>' +
      pair.event.owner + '</td><td>' + formatDate(pair.event.date) + '</td><td><strong>' + progress.percent +
      '%</strong></td><td><button class="button small" data-open-event="' + pair.event.id + '" data-project="' +
      pair.project.id + '">查看清单</button></td></tr>';
  }).join("");
  viewNode.innerHTML =
    heading("工作台", "上午好，陈佳", "这里汇总了项目资料的最新进展和需要你关注的事项。",
      '<button class="button" data-action="new-project">＋ 新建项目</button><button class="button primary" data-action="new-event">＋ 新建业务事项</button>') +
    '<section class="stats-grid">' +
      statCard("进行中项目", activeProjects.length, "个", "共 " + appState.projects.length + " 个项目", "▤", "") +
      statCard("未完成事项", openEvents.length, "项", "需要持续跟进", "◷", "blue") +
      statCard("待处理文件", pending.length, "份", "填写、签字或归档未完成", "!", "orange") +
      statCard("本月已归档", allEvents().flatMap(function (x) { return x.event.files; }).filter(function (x) { return x.archived === "done"; }).length, "份", "文件已完整归集", "✓", "") +
    '</section><section class="two-columns">' +
      '<article class="panel"><header class="panel-header"><div><h2>待处理提醒</h2><p>优先处理近期业务中的缺失资料</p></div><button class="button text" data-nav="pending">查看全部　→</button></header><div class="panel-body"><ul class="notice-list">' + notices + '</ul></div></article>' +
      '<article class="panel"><header class="panel-header"><div><h2>项目资料进度</h2><p>按项目查看整体完成情况</p></div><button class="button text" data-nav="projects">项目管理　→</button></header><div class="panel-body">' + projectProgress + '</div></article>' +
    '</section><section class="panel"><header class="panel-header"><div><h2>最近业务事项</h2><p>查看近期发货、收货和培训资料</p></div></header><div class="table-wrap"><table class="data-table"><thead><tr><th>业务事项</th><th>所属项目</th><th>类型</th><th>负责人</th><th>日期</th><th>完成度</th><th></th></tr></thead><tbody>' +
      recentRows + '</tbody></table></div></section>';
}

function statCard(label, value, unit, hint, icon, className) {
  return '<article class="stat-card"><div class="stat-top"><span>' + label + '</span><span class="stat-icon ' + className +
    '">' + icon + '</span></div><div class="stat-value"><strong>' + value + '</strong><small>' + unit +
    '</small></div><div class="stat-hint">' + hint + '</div></article>';
}

function renderProjects() {
  setBreadcrumb(["项目管理"]);
  const filtered = appState.projects.filter(function (project) {
    const searchText = (project.name + project.customer + project.code).toLowerCase();
    const searchMatch = !appState.search || searchText.includes(appState.search.toLowerCase());
    const complete = project.events.length > 0 && project.events.every(function (event) {
      return eventProgress(event).percent === 100;
    });
    const filterMatch = appState.projectFilter === "all" ||
      (appState.projectFilter === "active" && !complete) ||
      (appState.projectFilter === "complete" && complete);
    return searchMatch && filterMatch;
  });
  const filters = [["all","全部项目"],["active","进行中"],["complete","已完成"]].map(function (item) {
    return '<button class="filter-pill ' + (appState.projectFilter === item[0] ? "active" : "") +
      '" data-project-filter="' + item[0] + '">' + item[1] + '</button>';
  }).join("");
  const rows = filtered.map(function (project) {
    const total = project.events.reduce(function (sum,event) { return sum + eventProgress(event).total; }, 0);
    const done = project.events.reduce(function (sum,event) { return sum + eventProgress(event).done; }, 0);
    const percent = total ? Math.round(done / total * 100) : 0;
    return '<tr><td class="name-cell"><button class="link-button" data-open-project="' + project.id + '">' +
      project.name + '</button><small>' + project.code + '</small></td><td>' + project.customer + '</td><td>' +
      project.owner + '</td><td><div class="template-tags">' + project.templates.map(typeTag).join("") +
      '</div></td><td>' + project.events.length + ' 项</td><td><strong>' + percent +
      '%</strong></td><td><button class="button small" data-open-project="' + project.id + '">进入项目</button></td></tr>';
  }).join("");
  viewNode.innerHTML =
    heading("项目管理", "所有项目", "项目用于集中保存客户信息、业务事项和相关文件。",
      '<button class="button primary" data-action="new-project">＋ 新建项目</button>') +
    '<div class="filter-row"><div class="filter-pills">' + filters + '</div><span class="filter-count">共 ' +
      filtered.length + ' 个项目</span></div>' +
    '<section class="panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>项目名称</th><th>客户</th><th>负责人</th><th>适用模板</th><th>业务事项</th><th>资料进度</th><th></th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">⌕</div><h3>没有找到项目</h3><p>可以更换筛选条件或新建项目。</p></div></td></tr>') +
    '</tbody></table></div></section>';
}

function renderProject() {
  const project = appState.projects.find(function (item) { return item.id === appState.selectedProjectId; });
  if (!project) {
    appState.view = "projects";
    render();
    return;
  }
  setBreadcrumb(["项目管理", project.name]);
  const total = project.events.reduce(function (sum,event) { return sum + eventProgress(event).total; }, 0);
  const done = project.events.reduce(function (sum,event) { return sum + eventProgress(event).done; }, 0);
  const percent = total ? Math.round(done / total * 100) : 0;
  let body = "";
  if (appState.projectTab === "events") {
    const cards = project.events.map(function (event) {
      const progress = eventProgress(event);
      const iconClass = event.type === "receiving" ? "receiving" : event.type === "training" ? "training" : "";
      return '<article class="event-card"><span class="event-icon ' + iconClass + '">' + templateMap[event.type].icon +
        '</span><div class="event-main"><strong>' + event.name + '</strong><small>' + templateMap[event.type].label +
        ' · ' + formatDate(event.date) + ' · 经办人 ' + event.owner + ' · ' + event.files.length +
        ' 份文件</small></div><div class="event-progress"><span>' + progress.done + ' / ' + progress.total +
        ' 个步骤完成 · ' + progress.percent + '%</span>' + progressBar(progress.percent) +
        '</div><button class="button small" data-open-event="' + event.id + '" data-project="' + project.id +
        '">查看文件清单</button></article>';
    }).join("");
    body = '<div class="section-bar"><h2>业务事项</h2><span class="filter-count">每次业务使用独立文件清单</span></div><div class="event-list">' +
      (cards || '<div class="panel empty-state"><div class="empty-icon">▤</div><h3>还没有业务事项</h3><p>创建事项后，系统将根据模板生成文件清单。</p><button class="button primary" data-action="new-event" data-project="' + project.id + '">新建业务事项</button></div>') + '</div>';
  } else {
    body = '<section class="panel"><header class="panel-header"><div><h2>项目基本信息</h2><p>这些信息会在项目内长期使用</p></div></header><div class="panel-body"><div class="info-grid">' +
      infoItem("项目编号", project.code) + infoItem("项目负责人", project.owner) +
      infoItem("客户名称", project.customer) + infoItem("客户联系人", project.contact || "未填写") +
      '<div class="info-item"><small>默认适用模板</small><div class="template-tags">' + project.templates.map(typeTag).join("") + '</div></div>' +
      infoItem("项目备注", project.note || "无") + infoItem("项目文件夹", project.folder || "未选择") +
      infoItem("已导入模板文件", (project.importedFiles || 0) + " 份") + '</div></div></section>';
  }
  viewNode.innerHTML =
    heading(project.code, project.name, project.note || "暂无项目备注",
      '<button class="button" data-action="edit-project">编辑项目</button><button class="button primary" data-action="new-event" data-project="' + project.id + '">＋ 新建业务事项</button>') +
    '<section class="project-summary"><div class="summary-main"><h2>' + project.customer + '</h2><p>' +
      (project.contact || "暂未填写客户联系人") + '</p></div><div class="summary-item"><small>项目负责人</small><strong>' +
      project.owner + '</strong></div><div class="summary-item"><small>业务事项</small><strong>' +
      project.events.length + ' 项</strong></div><div class="summary-item summary-progress"><small>资料完成度　' +
      percent + '%</small>' + progressBar(percent) + '</div></section>' +
    '<div class="tabs"><button class="' + (appState.projectTab === "events" ? "active" : "") +
      '" data-project-tab="events">业务事项</button><button class="' + (appState.projectTab === "info" ? "active" : "") +
      '" data-project-tab="info">项目信息</button></div>' + body;
}

function infoItem(label, value) {
  return '<div class="info-item"><small>' + label + '</small><strong>' + value + '</strong></div>';
}

function renderPending() {
  setBreadcrumb(["待处理文件"]);
  let items = pendingFiles();
  if (appState.pendingFilter !== "all") {
    items = items.filter(function (item) { return item.gaps.includes(appState.pendingFilter); });
  }
  const filters = [["all","全部"],["未上传","未上传"],["待填写","待填写"],["待签字","待签字"],["待归档","待归档"]]
    .map(function (item) {
      return '<button class="filter-pill ' + (appState.pendingFilter === item[0] ? "active" : "") +
        '" data-pending-filter="' + item[0] + '">' + item[1] + '</button>';
    }).join("");
  const rows = items.map(function (item) {
    const gapTags = item.gaps.map(function (gap) {
      return '<span class="tag ' + (gap === "待签字" ? "orange" : "gray") + '">' + gap + '</span>';
    }).join(" ");
    return '<tr><td class="name-cell"><strong>' + item.file.name + '</strong><small>' +
      (item.file.attachment || "暂未上传附件") + '</small></td><td>' + item.project.name + '</td><td>' +
      item.event.name + '</td><td>' + gapTags + '</td><td>' + item.event.owner + '</td><td>' +
      formatDate(item.event.date) + '</td><td><button class="button small" data-open-event="' +
      item.event.id + '" data-project="' + item.project.id + '">处理</button></td></tr>';
  }).join("");
  viewNode.innerHTML =
    heading("待处理文件", "需要跟进的资料", "从这里集中查看未上传、未填写、未签字和未归档的文件。") +
    '<div class="filter-row"><div class="filter-pills">' + filters + '</div><span class="filter-count">共 ' +
      items.length + ' 份文件</span></div><section class="panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>文件</th><th>所属项目</th><th>业务事项</th><th>待处理</th><th>负责人</th><th>业务日期</th><th></th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">✓</div><h3>当前没有待处理文件</h3><p>这个筛选条件下的资料已全部完成。</p></div></td></tr>') +
      '</tbody></table></div></section>';
}

function renderTemplates() {
  setBreadcrumb(["文件模板"]);
  const cards = Object.keys(templateMap).map(function (type) {
    const template = templateMap[type];
    const iconClass = type === "receiving" ? "receiving" : type === "training" ? "training" : "";
    const assetList = template.assets.map(function (asset, index) {
      return '<div class="template-file"><span class="file-type">' + fileExtension(asset.name) +
        '</span><span class="template-file-name"><strong>' + asset.name + '</strong><small>' +
        asset.size + (asset.source === "upload" ? " · 已上传" : " · 演示文件") +
        '</small></span><button class="button text small" data-export-asset="' + type + '" data-asset-index="' +
        index + '">导出</button></div>';
    }).join("");
    return '<article class="template-card"><span class="event-icon ' + iconClass + '">' + template.icon +
      '</span><h2>' + template.name + '</h2><p>' + template.description + '</p><div class="mini-list">' +
      assetList + '</div><footer><span>' + template.assets.length + ' 个模板文件</span><span class="template-actions">' +
      '<label class="button small upload-inline">＋ 上传<input type="file" multiple data-template-upload="' + type + '"></label>' +
      '<button class="button small" data-export-template="' + type + '">全部导出</button></span></footer>' +
      '<button class="button text small template-rule-link" data-template="' + type + '">查看文件要求</button></article>';
  }).join("");
  viewNode.innerHTML = heading("文件模板", "模板文件库", "把常用的 Word、Excel 等空白模板放在这里，需要时可导出或复制到项目文件夹。") +
    '<div class="template-tip"><span>i</span><div><strong>模板文件只保存一份</strong><p>新建项目时选择所需模板，系统会复制一份到项目文件夹，原始模板保持不变。</p></div></div>' +
    '<section class="template-grid">' + cards + '</section>';
}

function fileExtension(name) {
  const parts = name.split(".");
  return parts.length > 1 ? parts.pop().toUpperCase() : "FILE";
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}

function openProjectModal(project) {
  const isEdit = Boolean(project);
  selectedDirectoryHandle = null;
  const templateChecks = Object.keys(templateMap).map(function (type) {
    const checked = project ? project.templates.includes(type) : type === "shipping";
    return '<label class="check-option"><input type="checkbox" name="templates" value="' + type + '" ' +
      (checked ? "checked" : "") + '>' + templateMap[type].label + '</label>';
  }).join("");
  modalNode.innerHTML =
    '<div class="modal-backdrop"><form class="modal" id="projectForm" data-edit-id="' + (project ? project.id : "") + '">' +
    '<header class="modal-head"><div><h2>' + (isEdit ? "编辑项目" : "新建项目") +
    '</h2><p>填写项目信息，选择需要导入的模板文件和保存位置。</p></div><button type="button" class="modal-close" data-close-modal>×</button></header>' +
    '<div class="modal-body"><div class="field-grid">' +
      '<div class="field full"><label>项目名称</label><input id="projectNameInput" name="name" placeholder="例如：华南工厂设备交付" value="' +
      (project ? project.name : "") + '" required></div>' +
      fieldInput("客户名称", "customer", "客户公司名称", project ? project.customer : "", true, "") +
      '<div class="field"><label>项目负责人</label>' + ownerSelect(project ? project.owner : "陈佳") + '</div>' +
      fieldInput("客户联系人", "contact", "姓名、电话等", project ? project.contact : "", false, "full") +
      '<div class="field full"><span>导入项目的模板文件</span><div class="check-row">' + templateChecks +
      '</div><p class="form-help">创建项目时，会将所选模板组中的文件复制到项目文件夹；以后创建业务事项时也会优先显示这些模板。</p></div>' +
      '<div class="field full"><label>项目备注</label><textarea name="note" placeholder="简要说明项目内容">' +
      (project ? project.note : "") + '</textarea></div>' +
      '<div class="field full"><span>项目文件夹</span><div class="folder-picker"><button type="button" class="button" data-action="select-folder">▣　选择上级文件夹</button>' +
      '<div class="folder-preview" id="folderPreview"><strong>' + (project && project.folder ? project.folder : "尚未选择保存位置") +
      '</strong><small>' + (project && project.folder ? "更换位置后，会使用项目名称创建新文件夹" : "选择后将自动创建“上级文件夹、项目名称”目录") +
      '</small></div></div><p class="form-help">浏览器会在你选择的位置下创建与项目名称相同的文件夹，并按发货、收货或培训分类复制模板文件。</p></div>' +
    '</div></div><footer class="modal-footer"><button type="button" class="button" data-close-modal>取消</button><button type="submit" class="button primary">' +
    (isEdit ? "保存修改" : "创建项目") + '</button></footer></form></div>';
}

function fieldInput(label, name, placeholder, value, required, extraClass) {
  return '<div class="field ' + extraClass + '"><label>' + label + '</label><input name="' + name +
    '" placeholder="' + placeholder + '" value="' + value + '" ' + (required ? "required" : "") + '></div>';
}

function ownerSelect(owner) {
  return '<select name="owner">' + ["陈佳","林晓","周远"].map(function (name) {
    return '<option ' + (name === owner ? "selected" : "") + '>' + name + '</option>';
  }).join("") + '</select>';
}

function safeFolderName(name) {
  return (name || "未命名项目").replace(/[\\/:*?"<>|]/g, "_").trim();
}

function updateFolderPreview() {
  const preview = document.querySelector("#folderPreview");
  if (!preview || !selectedDirectoryHandle) return;
  const projectName = safeFolderName(document.querySelector("#projectNameInput").value);
  preview.innerHTML = '<strong>' + selectedDirectoryHandle.name + '\\' + projectName +
    '</strong><small>将创建项目文件夹，并导入当前勾选的模板文件</small>';
}

async function chooseProjectFolder() {
  try {
    if (window.showDirectoryPicker) {
      selectedDirectoryHandle = await window.showDirectoryPicker({ mode:"readwrite" });
    } else {
      selectedDirectoryHandle = { name:"项目资料（模拟位置）", mock:true };
      toast("当前浏览器使用模拟文件夹选择");
    }
    updateFolderPreview();
  } catch (error) {
    if (error.name !== "AbortError") toast("未能选择文件夹，请重试");
  }
}

async function createProjectFolder(projectName, selectedTemplates) {
  const folderName = safeFolderName(projectName);
  const result = {
    path:selectedDirectoryHandle.name + "\\" + folderName,
    importedFiles:selectedTemplates.reduce(function (sum,type) { return sum + templateMap[type].assets.length; }, 0)
  };
  if (selectedDirectoryHandle.mock || !selectedDirectoryHandle.getDirectoryHandle) return result;
  const projectDirectory = await selectedDirectoryHandle.getDirectoryHandle(folderName, { create:true });
  for (const type of selectedTemplates) {
    const template = templateMap[type];
    const typeDirectory = await projectDirectory.getDirectoryHandle(template.label + "资料", { create:true });
    for (const asset of template.assets) {
      const storedFile = asset.fileKey ? uploadedTemplateFiles.get(asset.fileKey) : null;
      const outputName = storedFile ? asset.name : asset.name + "_演示说明.txt";
      const outputFile = await typeDirectory.getFileHandle(outputName, { create:true });
      const writable = await outputFile.createWritable();
      const content = storedFile || new Blob([
        "这是 WorkPack 前端 Demo 的演示模板占位文件。\n",
        "正式产品中，此处会复制模板库内上传的原始文件：", asset.name
      ], { type:"text/plain;charset=utf-8" });
      await writable.write(content);
      await writable.close();
    }
  }
  return result;
}

function downloadTemplateAsset(type, index) {
  const asset = templateMap[type].assets[Number(index)];
  if (!asset) return;
  const storedFile = asset.fileKey ? uploadedTemplateFiles.get(asset.fileKey) : null;
  const blob = storedFile || new Blob([
    "这是 WorkPack 前端 Demo 的演示模板说明。\n",
    "正式产品将导出模板库内的原始文件：", asset.name
  ], { type:"text/plain;charset=utf-8" });
  const fileName = storedFile ? asset.name : asset.name + "_演示说明.txt";
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}

function exportTemplateGroup(type) {
  templateMap[type].assets.forEach(function (asset, index) {
    window.setTimeout(function () { downloadTemplateAsset(type, index); }, index * 120);
  });
  toast("已开始导出 " + templateMap[type].assets.length + " 个模板文件");
}

function openEventModal(projectId) {
  const selectedId = projectId || appState.selectedProjectId || appState.projects[0].id;
  const projectOptions = appState.projects.map(function (project) {
    return '<option value="' + project.id + '" ' + (project.id === Number(selectedId) ? "selected" : "") +
      '>' + project.name + '</option>';
  }).join("");
  const typeOptions = Object.keys(templateMap).map(function (type) {
    return '<option value="' + type + '">' + templateMap[type].label + '</option>';
  }).join("");
  modalNode.innerHTML =
    '<div class="modal-backdrop"><form class="modal" id="eventForm">' +
    '<header class="modal-head"><div><h2>新建业务事项</h2><p>系统会根据所选模板生成一份独立文件清单。</p></div><button type="button" class="modal-close" data-close-modal>×</button></header>' +
    '<div class="modal-body"><div class="field-grid">' +
      '<div class="field full"><label>所属项目</label><select name="projectId">' + projectOptions + '</select></div>' +
      '<div class="field"><label>业务类型</label><select name="type" id="eventType">' + typeOptions + '</select></div>' +
      '<div class="field"><label>业务日期</label><input name="date" type="date" value="2026-09-23" required></div>' +
      '<div class="field full"><label>事项名称</label><input name="name" required value="设备发货" placeholder="例如：第一批设备发货"></div>' +
      '<div class="field"><label>经办人</label>' + ownerSelect("陈佳") + '</div>' +
      '<div class="field"><label>使用模板</label><input id="templatePreviewName" value="' + templateMap.shipping.name + '" disabled></div>' +
      '<div class="field full"><span>将生成的文件清单</span><div class="preview-box" id="templatePreview">' +
      templateMap.shipping.files.map(function (file) { return "· " + file[0]; }).join("<br>") + '</div></div>' +
    '</div></div><footer class="modal-footer"><button type="button" class="button" data-close-modal>取消</button><button type="submit" class="button primary">创建并查看清单</button></footer></form></div>';
}

function statusSelect(value, projectId, eventId, fileIndex, step) {
  if (value === "na") return '<select class="doc-status na" disabled><option>不适用</option></select>';
  return '<select class="doc-status ' + value + '" data-file-status data-project="' + projectId +
    '" data-event="' + eventId + '" data-file="' + fileIndex + '" data-step="' + step +
    '"><option value="pending" ' + (value === "pending" ? "selected" : "") +
    '>待完成</option><option value="done" ' + (value === "done" ? "selected" : "") + '>已完成</option></select>';
}

function openEventDetail(projectId, eventId) {
  const project = appState.projects.find(function (item) { return item.id === Number(projectId); });
  const event = project && project.events.find(function (item) { return item.id === Number(eventId); });
  if (!event) return;
  const progress = eventProgress(event);
  const rows = event.files.map(function (file, index) {
    const uploader = '<label class="upload-button ' + (file.attachment ? "has-file" : "") +
      '"><input type="file" data-upload="' + index + '" data-project="' + project.id + '" data-event="' +
      event.id + '"><span>' + (file.attachment || "＋ 模拟上传") + '</span></label>';
    return '<tr><td class="doc-name"><strong>' + file.name + '</strong><small>' + file.note +
      '</small></td><td>' + uploader + '</td>' +
      ["prepared","filled","signed","archived"].map(function (step) {
        return "<td>" + statusSelect(file[step], project.id, event.id, index, step) + "</td>";
      }).join("") + "</tr>";
  }).join("");
  modalNode.innerHTML =
    '<div class="modal-backdrop"><div class="modal wide"><header class="modal-head"><div><h2>' + event.name +
    '</h2><p>' + project.name + ' · ' + templateMap[event.type].label + ' · ' + formatDate(event.date) +
    '</p></div><button type="button" class="modal-close" data-close-modal>×</button></header>' +
    '<div class="modal-body"><div class="modal-meta"><span>经办人　<strong>' + event.owner +
    '</strong></span><span>使用模板　<strong>' + templateMap[event.type].name +
    '</strong></span><span>文件数量　<strong>' + event.files.length + ' 份</strong></span></div>' +
    '<div class="completion-strip"><strong>' + progress.percent + '%</strong><span>' + progress.done +
    ' / ' + progress.total + ' 个必要步骤已完成</span>' + progressBar(progress.percent) + '</div>' +
    '<div class="table-wrap"><table class="doc-table"><thead><tr><th>文件名称</th><th>附件</th><th>已准备</th><th>已填写</th><th>已签字</th><th>已归档</th></tr></thead><tbody>' +
    rows + '</tbody></table></div><p class="form-help">本 demo 中的上传只记录文件名，不会把文件发送或保存到任何位置。</p></div>' +
    '<footer class="modal-footer"><button type="button" class="button" data-close-modal>关闭</button><button type="button" class="button primary" data-save-event>完成并返回</button></footer></div></div>';
}

function openTemplate(type) {
  const template = templateMap[type];
  const stepNames = {prepared:"准备", filled:"填写", signed:"签字", archived:"归档"};
  const items = template.files.map(function (file) {
    return '<li class="notice-item"><span class="notice-icon">▧</span><span class="notice-text"><strong>' +
      file[0] + '</strong><span>' + file[1] + '</span></span><span class="tag gray">' +
      file[2].map(function (step) { return stepNames[step]; }).join("、") + '</span></li>';
  }).join("");
  modalNode.innerHTML =
    '<div class="modal-backdrop"><div class="modal"><header class="modal-head"><div><h2>' + template.name +
    '</h2><p>' + template.description + '</p></div><button type="button" class="modal-close" data-close-modal>×</button></header>' +
    '<div class="modal-body"><ul class="notice-list">' + items +
    '</ul></div><footer class="modal-footer"><button type="button" class="button primary" data-close-modal>我知道了</button></footer></div></div>';
}

document.addEventListener("click", async function (event) {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.view) {
    appState.view = button.dataset.view;
    appState.search = "";
    document.querySelector("#globalSearch").value = "";
    render();
  }
  if (button.dataset.nav) {
    appState.view = button.dataset.nav;
    render();
  }
  if (button.dataset.action === "new-project") openProjectModal(null);
  if (button.dataset.action === "edit-project") {
    openProjectModal(appState.projects.find(function (item) { return item.id === appState.selectedProjectId; }));
  }
  if (button.dataset.action === "new-event") {
    if (!appState.projects.length) {
      toast("请先创建项目");
    } else {
      openEventModal(Number(button.dataset.project) || null);
    }
  }
  if (button.dataset.action === "select-folder") await chooseProjectFolder();
  if (button.dataset.closeModal !== undefined) modalNode.innerHTML = "";
  if (button.dataset.openProject) {
    appState.selectedProjectId = Number(button.dataset.openProject);
    appState.projectTab = "events";
    appState.view = "project";
    render();
  }
  if (button.dataset.projectTab) {
    appState.projectTab = button.dataset.projectTab;
    render();
  }
  if (button.dataset.projectFilter) {
    appState.projectFilter = button.dataset.projectFilter;
    render();
  }
  if (button.dataset.pendingFilter) {
    appState.pendingFilter = button.dataset.pendingFilter;
    render();
  }
  if (button.dataset.openEvent) openEventDetail(button.dataset.project, button.dataset.openEvent);
  if (button.dataset.template) openTemplate(button.dataset.template);
  if (button.dataset.exportAsset) downloadTemplateAsset(button.dataset.exportAsset, button.dataset.assetIndex);
  if (button.dataset.exportTemplate) exportTemplateGroup(button.dataset.exportTemplate);
  if (button.dataset.saveEvent !== undefined) {
    modalNode.innerHTML = "";
    render();
    toast("文件清单状态已更新");
  }
});

document.addEventListener("submit", async function (event) {
  event.preventDefault();
  const data = new FormData(event.target);
  if (event.target.id === "projectForm") {
    const selectedTemplates = data.getAll("templates");
    if (!selectedTemplates.length) {
      toast("请至少选择一个适用模板");
      return;
    }
    const editId = Number(event.target.dataset.editId);
    if (!editId && !selectedDirectoryHandle) {
      toast("请先选择项目文件夹");
      return;
    }
    let folderResult = null;
    if (selectedDirectoryHandle) {
      try {
        folderResult = await createProjectFolder(data.get("name"), selectedTemplates);
      } catch (error) {
        toast("项目文件夹创建失败，请检查文件夹权限");
        return;
      }
    }
    if (editId) {
      const project = appState.projects.find(function (item) { return item.id === editId; });
      Object.assign(project, {
        name:data.get("name"), customer:data.get("customer"), contact:data.get("contact"),
        owner:data.get("owner"), templates:selectedTemplates, note:data.get("note"),
        folder:folderResult ? folderResult.path : project.folder,
        importedFiles:folderResult ? folderResult.importedFiles : project.importedFiles
      });
      toast("项目信息已保存");
    } else {
      const id = Math.max.apply(null, [0].concat(appState.projects.map(function (item) { return item.id; }))) + 1;
      appState.projects.unshift({
        id:id, code:"WP-2026-" + String(id + 21).padStart(3, "0"),
        name:data.get("name"), customer:data.get("customer"), contact:data.get("contact"),
        owner:data.get("owner"), templates:selectedTemplates, note:data.get("note"),
        folder:folderResult.path, importedFiles:folderResult.importedFiles, events:[]
      });
      appState.selectedProjectId = id;
      appState.view = "project";
      toast("项目已创建");
    }
    modalNode.innerHTML = "";
    render();
  }
  if (event.target.id === "eventForm") {
    const project = appState.projects.find(function (item) { return item.id === Number(data.get("projectId")); });
    const type = data.get("type");
    const newEvent = {
      id:Date.now(), type:type, name:data.get("name"), date:data.get("date"),
      owner:data.get("owner"), files:createFiles(type)
    };
    project.events.unshift(newEvent);
    appState.selectedProjectId = project.id;
    appState.view = "project";
    modalNode.innerHTML = "";
    render();
    openEventDetail(project.id, newEvent.id);
    toast("业务事项已创建");
  }
});

document.addEventListener("change", function (event) {
  if (event.target.id === "projectNameInput") updateFolderPreview();
  if (event.target.matches("[data-template-upload]")) {
    const type = event.target.dataset.templateUpload;
    Array.from(event.target.files).forEach(function (file) {
      const fileKey = type + "-" + Date.now() + "-" + Math.random().toString(16).slice(2);
      uploadedTemplateFiles.set(fileKey, file);
      templateMap[type].assets.push({
        name:file.name, size:formatFileSize(file.size), source:"upload", fileKey:fileKey
      });
    });
    const count = event.target.files.length;
    renderTemplates();
    toast("已加入 " + count + " 个模板文件");
  }
  if (event.target.id === "eventType") {
    const template = templateMap[event.target.value];
    document.querySelector("#templatePreviewName").value = template.name;
    document.querySelector("#templatePreview").innerHTML = template.files.map(function (file) {
      return "· " + file[0];
    }).join("<br>");
    document.querySelector('#eventForm [name="name"]').value = "设备" + template.label;
  }
  if (event.target.matches("[data-file-status]")) {
    const project = appState.projects.find(function (item) { return item.id === Number(event.target.dataset.project); });
    const item = project.events.find(function (eventItem) { return eventItem.id === Number(event.target.dataset.event); });
    item.files[Number(event.target.dataset.file)][event.target.dataset.step] = event.target.value;
    openEventDetail(project.id, item.id);
  }
  if (event.target.matches("[data-upload]")) {
    const project = appState.projects.find(function (item) { return item.id === Number(event.target.dataset.project); });
    const item = project.events.find(function (eventItem) { return eventItem.id === Number(event.target.dataset.event); });
    const file = item.files[Number(event.target.dataset.upload)];
    if (event.target.files[0]) {
      file.attachment = event.target.files[0].name;
      file.prepared = "done";
      openEventDetail(project.id, item.id);
      toast("已记录文件名（模拟上传）");
    }
  }
});

document.querySelector("#globalSearch").addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    appState.search = event.target.value.trim();
    appState.view = "projects";
    render();
  }
});

document.addEventListener("input", function (event) {
  if (event.target.id === "projectNameInput") updateFolderPreview();
});

document.querySelector("#resetDemo").addEventListener("click", function () {
  appState = {
    view:"home", projects:structuredClone(seedProjects), selectedProjectId:null,
    projectTab:"events", projectFilter:"all", pendingFilter:"all", search:""
  };
  Object.keys(templateMap).forEach(function (type) {
    templateMap[type].assets = structuredClone(initialTemplateAssets[type]);
  });
  uploadedTemplateFiles.clear();
  selectedDirectoryHandle = null;
  document.querySelector("#globalSearch").value = "";
  render();
  toast("演示数据已恢复");
});

render();
