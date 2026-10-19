import {Extension} from "@tiptap/core";
import {Plugin, PluginKey} from "@tiptap/pm/state";
import {Decoration, DecorationSet} from "@tiptap/pm/view";

const DAY_REGEX = /^(Понедельник|Вторник|Среда|Четверг|Пятница|Суббота|Воскресенье|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Пн|Вт|Ср|Чт|Пт|Сб|Вс)$/i;

const DAY_CLASS_MAP = {
  "понедельник": "is-monday",
  "пн": "is-monday",
  "monday": "is-monday",
  "вторник": "is-tuesday",
  "вт": "is-tuesday",
  "tuesday": "is-tuesday",
  "среда": "is-wednesday",
  "ср": "is-wednesday",
  "wednesday": "is-wednesday",
  "четверг": "is-thursday",
  "чт": "is-thursday",
  "thursday": "is-thursday",
  "пятница": "is-friday",
  "пт": "is-friday",
  "friday": "is-friday",
  "суббота": "is-saturday",
  "сб": "is-saturday",
  "saturday": "is-saturday",
  "воскресенье": "is-sunday",
  "вс": "is-sunday",
  "sunday": "is-sunday",
};

const TIME_REGEX = /\b([01]?\d|2[0-3]):[0-5]\d\b/g;
const TASK_CHECKBOX_REGEX = /^\\?\[([ xX])\\?\]\s*/;

export const TableSmartDecorations = Extension.create({
  name: "tableSmartDecorations",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("tableSmartDecorations"),
        props: {
          decorations(state) {
            const decorations = [];
            const doc = state.doc;

            doc.descendants((node, pos) => {
              // Only process tableCell and tableHeader nodes
              if (node.type.name !== "tableCell" && node.type.name !== "tableHeader") {
                return true;
              }

              // Scan direct text descendants inside the cell
              node.descendants((child, childPos) => {
                if (!child.isText) return;
                const absolutePos = pos + 1 + childPos;
                const text = child.text || "";

                // 1. Interactive task checkbox at start of cell/paragraph
                const isStartOfParagraph = childPos === 0 || childPos === 1;
                const taskMatch = isStartOfParagraph ? text.match(TASK_CHECKBOX_REGEX) : null;
                if (taskMatch) {
                  const isChecked = taskMatch[1].toLowerCase() === "x";
                  const matchLen = taskMatch[0].length;
                  const hasEscape = text.startsWith("\\[");

                  // Hide the raw "[ ] " or "[x] " text syntax
                  decorations.push(
                    Decoration.inline(absolutePos, absolutePos + matchLen, {
                      class: "cell-task-syntax-hidden",
                    })
                  );

                  // Place an interactive checkbox widget
                  decorations.push(
                    Decoration.widget(
                      absolutePos,
                      (view) => {
                        const btn = document.createElement("button");
                        btn.type = "button";
                        btn.className = `cell-task-checkbox ${isChecked ? "is-checked" : ""}`;
                        btn.setAttribute("aria-label", isChecked ? "Выполнено" : "Не выполнено");
                        btn.title = isChecked ? "Снять отметку" : "Отметить выполненным";

                        const box = document.createElement("span");
                        box.className = "cell-task-box";
                        if (isChecked) {
                          box.innerHTML = `<svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
                        }
                        btn.appendChild(box);

                        btn.addEventListener("mousedown", (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const tr = view.state.tr;
                          const newSyntax = isChecked
                            ? (hasEscape ? "\\[ \\] " : "[ ] ")
                            : (hasEscape ? "\\[x\\] " : "[x] ");
                          tr.replaceWith(absolutePos, absolutePos + matchLen, view.state.schema.text(newSyntax));
                          view.dispatch(tr);
                        });

                        return btn;
                      },
                      {side: -1, stopEvent: () => true}
                    )
                  );
                }

                // 2. Day badges detection
                const trimmed = text.trim();
                const dayMatch = trimmed.match(DAY_REGEX);
                if (dayMatch && dayMatch[0] === trimmed) {
                  const dayClass = DAY_CLASS_MAP[trimmed.toLowerCase()];
                  if (dayClass) {
                    const startOffset = text.indexOf(trimmed);
                    decorations.push(
                      Decoration.inline(absolutePos + startOffset, absolutePos + startOffset + trimmed.length, {
                        class: `cell-day-badge ${dayClass}`,
                      })
                    );
                  }
                }

                // 3. Time chips detection
                let timeMatch;
                const timeRegex = new RegExp(TIME_REGEX);
                while ((timeMatch = timeRegex.exec(text)) !== null) {
                  const start = absolutePos + timeMatch.index;
                  const end = start + timeMatch[0].length;
                  decorations.push(
                    Decoration.inline(start, end, {
                      class: "cell-time-chip",
                    })
                  );
                }
              });

              return false;
            });

            return DecorationSet.create(doc, decorations);
          },
        },
      }),
    ];
  },
});
