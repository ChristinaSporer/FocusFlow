export function buildRow(main, sub, { done = false, onDelete, actions = [] } = {}) {
  const li = document.createElement("li");
  li.className = [
    "list-group-item",
    "d-flex",
    "justify-content-between",
    "align-items-start",
    "gap-3",
    done ? "list-group-item-success" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const info = document.createElement("div");
  info.className = "d-flex flex-column gap-1 flex-grow-1";
  info.style.minWidth = "0";
  const title = document.createElement("span");
  title.textContent = main;
  const small = document.createElement("small");
  small.className = "text-body-secondary";
  if (Array.isArray(sub)) {
    sub.filter(Boolean).forEach((line, i) => {
      if (i > 0) small.appendChild(document.createElement("br"));
      small.appendChild(document.createTextNode(line));
    });
  } else {
    small.textContent = sub;
  }
  info.append(title, small);

  const rowActions = document.createElement("div");
  rowActions.className = "d-flex align-items-start gap-2 flex-shrink-0 align-self-start ms-auto";

  actions.forEach((action) => {
    if (action.tagName === "INPUT" && action.type === "checkbox") {
      action.classList.add("form-check-input", "mt-1", "flex-shrink-0");
    }
    rowActions.appendChild(action);
  });

  const del = document.createElement("button");
  del.className = "btn btn-outline-danger btn-sm";
  del.type = "button";
  del.setAttribute("aria-label", "Löschen");
  del.innerHTML = '<i class="bi bi-trash"></i>';
  del.addEventListener("click", onDelete);
  rowActions.appendChild(del);

  li.append(info, rowActions);
  return li;
}

export function renderEmptyList(list, message) {
  list.innerHTML = `<li class="list-group-item text-body-secondary">${message}</li>`;
}
