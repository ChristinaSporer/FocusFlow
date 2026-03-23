export function buildRow(main, sub, { done = false, onDelete, actions = [] } = {}) {
  const li = document.createElement("li");
  li.className = [
    "list-group-item",
    "d-flex",
    "justify-content-between",
    "align-items-start",
    "gap-3",
    "flex-wrap",
    done ? "list-group-item-success" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const info = document.createElement("div");
  info.className = "d-flex flex-column gap-1 flex-grow-1";
  const title = document.createElement("span");
  title.textContent = main;
  const small = document.createElement("small");
  small.className = "text-body-secondary";
  small.textContent = sub;
  info.append(title, small);

  const rowActions = document.createElement("div");
  rowActions.className = "d-flex align-items-center gap-2 ms-auto";

  actions.forEach((action) => {
    if (action.tagName === "INPUT" && action.type === "checkbox") {
      action.classList.add("form-check-input", "mt-1", "flex-shrink-0");
    }
    rowActions.appendChild(action);
  });

  const del = document.createElement("button");
  del.className = "btn btn-outline-danger btn-sm";
  del.type = "button";
  del.textContent = "Löschen";
  del.addEventListener("click", onDelete);
  rowActions.appendChild(del);

  li.append(info, rowActions);
  return li;
}

export function renderEmptyList(list, message) {
  list.innerHTML = `<li class="list-group-item text-body-secondary">${message}</li>`;
}
