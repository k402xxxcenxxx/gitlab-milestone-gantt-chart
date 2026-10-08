// Escape HTML special characters. jquery.fn.gantt concatenates label, desc and
// name directly into HTML, so any text coming from GitLab must be escaped to
// prevent XSS (e.g. an issue title such as <img src=x onerror=...>).
function escape_html(value) {
    return String(value ?? "").replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
const GANTT_ID = "gantt-chart";
const INITIAL_SCALE = "weeks";   // "hours", "days", "weeks" or "months"
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Group for issues without a milestone (always shown last)
const NO_MILESTONE_ID = "__no_milestone__";
const NO_MILESTONE_TITLE = "No milestone";
const NO_MILESTONE_COLLAPSED_BY_DEFAULT = false;

// Rows per page. The library defaults to 7; a high value shows every row on a
// single page.
const ITEMS_PER_PAGE = 1000;

// State kept between re-renders (when collapsing/expanding milestones)
const gantt_state = {
    milestones: [],
    collapsed: new Set(NO_MILESTONE_COLLAPSED_BY_DEFAULT ? [NO_MILESTONE_ID] : []),
    rendered_once: false
};

function parse_day(yyyy_mm_dd) {
    return yyyy_mm_dd ? new Date(yyyy_mm_dd + "T12:00:00") : null;
}

function format_day(date) {
    return date.toLocaleDateString();
}

// ---------------------------------------------------------------------------
// 1. Turn the GraphQL data into a list of milestones with their issues
// ---------------------------------------------------------------------------
// native_dates: map iid -> { startDate, dueDate } read from the work item
// "Start and due date" widget (GitLab's native issue start date). May be empty.
function process_gantt_data(gantt_data, native_dates = {}) {
    let milestone_dict = {};
    gantt_data.project.milestones.nodes.forEach(function (milestone) {
        milestone_dict[milestone.id] = {
            id: milestone.id,
            title: milestone.title,
            startDate: milestone.startDate,
            dueDate: milestone.dueDate,
            issue_list: []
        };
    });

    // Accepts "/start_date 2026/09/15", "/start_date: 2026-09-15", etc.
    const start_date_re = /\/start_date[:\s]*(\d{4}[-/]\d{1,2}[-/]\d{1,2})/i;

    gantt_data.project.issues.nodes.forEach(function (issue) {
        let ms;
        if (issue.milestone == null) {
            if (!milestone_dict[NO_MILESTONE_ID]) {
                milestone_dict[NO_MILESTONE_ID] = {
                    id: NO_MILESTONE_ID,
                    title: NO_MILESTONE_TITLE,
                    startDate: null,
                    dueDate: null,
                    no_milestone: true,
                    issue_list: []
                };
            }
            ms = milestone_dict[NO_MILESTONE_ID];
        } else {
            // Milestone not returned in the project list (e.g. a group
            // milestone): create it from the data returned with the issue
            if (!milestone_dict[issue.milestone.id]) {
                milestone_dict[issue.milestone.id] = {
                    id: issue.milestone.id,
                    title: issue.milestone.title,
                    startDate: issue.milestone.startDate,
                    dueDate: issue.milestone.dueDate,
                    issue_list: []
                };
            }
            ms = milestone_dict[issue.milestone.id];
        }

        // Start date, in order of priority:
        // 1. GitLab's native "Start date" field
        // 2. "/start_date YYYY-MM-DD" in the description
        // 3. the milestone's start date
        // 4. the issue's creation date
        const native = native_dates[issue.iid] || {};
        const start_date_match = start_date_re.exec(issue.description || "");
        let start;
        if (native.startDate) {
            start = parse_day(native.startDate);
        } else if (start_date_match) {
            start = parse_day(start_date_match[1].replace(/\//g, "-"));
        } else if (ms.startDate) {
            start = parse_day(ms.startDate);
        } else {
            start = new Date(issue.createdAt);
        }

        // Due date; without one (or if it is before the start), use start + 1 day
        let due = parse_day(issue.dueDate || native.dueDate);
        if (!due || due < start) {
            due = new Date(start.getTime() + ONE_DAY_MS);
        }

        ms.issue_list.push({
            id: issue.id,
            title: issue.title,
            description: issue.description,
            webUrl: issue.webUrl,
            closed: issue.state === "closed",
            from: start.getTime(),
            to: due.getTime()
        });
    });

    // Keep the "No milestone" group last
    return Object.values(milestone_dict).sort(
        (a, b) => (a.no_milestone ? 1 : 0) - (b.no_milestone ? 1 : 0)
    );
}

// ---------------------------------------------------------------------------
// 2. Build the chart rows (skipping issues of collapsed milestones)
// ---------------------------------------------------------------------------
function build_gantt_items(milestones, collapsed) {
    let gantt_items = [];

    milestones.forEach(function (ms) {
        const issues = ms.issue_list;
        const total = issues.length;
        const closed = issues.filter(i => i.closed).length;
        const is_collapsed = collapsed.has(ms.id);

        // Milestone period: its own dates; if one is missing, estimate it from
        // the period covered by its issues.
        let start = parse_day(ms.startDate);
        let end = parse_day(ms.dueDate);
        const estimated = !start || !end;
        if (!start && total > 0) start = new Date(Math.min(...issues.map(i => i.from)));
        if (!end && total > 0) end = new Date(Math.max(...issues.map(i => i.to)));
        if (start && !end) end = new Date(start.getTime() + ONE_DAY_MS);
        if (end && !start) start = new Date(end.getTime() - ONE_DAY_MS);
        if (start && end && end < start) end = new Date(start.getTime() + ONE_DAY_MS);

        const period = start
            ? `${format_day(start)} – ${format_day(end)}${estimated && !ms.no_milestone ? " (estimated)" : ""}`
            : "No dates";

        // Milestone row: only the milestone period, no issue. The name is HTML
        // built here (with escaped text) to include the collapse toggle.
        const arrow = is_collapsed ? "&#9656;" : "&#9662;"; // ▸ / ▾
        gantt_items.push({
            id: escape_html(ms.id),
            name: `<span class="gantt-ms-toggle" data-ms-id="${escape_html(ms.id)}" ` +
                  `title="Click to collapse/expand">${arrow} ${escape_html(ms.title)}</span>`,
            desc: escape_html(`${total} issues · ${closed} closed`),
            values: start ? [{
                from: start.getTime(),
                to: end.getTime(),
                label: escape_html(period),
                desc: escape_html(`${ms.title}: ${period}`),
                customClass: ms.no_milestone ? "ganttNoMilestone"
                    : estimated ? "ganttMilestone ganttMilestoneEstimated" : "ganttMilestone"
            }] : []
        });

        if (is_collapsed) return;

        issues.forEach(function (issue) {
            gantt_items.push({
                id: issue.id,
                desc: escape_html(issue.description),
                values: [{
                    from: issue.from,
                    to: issue.to,
                    label: escape_html(issue.title),
                    desc: escape_html(issue.description),
                    dataObj: issue.webUrl,
                    customClass: issue.closed ? "ganttIssueClosed" : "ganttIssueOpen"
                }]
            });
        });
    });

    return gantt_items;
}

// ---------------------------------------------------------------------------
// 3. Vertical line on the current day
// ---------------------------------------------------------------------------
function draw_today_line(el) {
    const $panel = $(el).find(".fn-gantt .dataPanel");
    $panel.find(".gantt-today-line").remove();

    // The library marks today's header cell with the "today" class
    const $cell = $panel.find(".today[offset]").first();
    if (!$cell.length) return; // today is outside the displayed range

    const left = parseFloat($cell.attr("offset"));
    const width = $cell.outerWidth();
    const now = new Date();

    // Position inside the cell, depending on the current scale
    let fraction;
    switch (current_scale(el)) {
        case "days":
            fraction = (now.getHours() + now.getMinutes() / 60) / 24;
            break;
        case "weeks":
            fraction = (now.getDay() + 0.5) / 7;
            break;
        case "months": {
            const days_in_month = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            fraction = (now.getDate() - 0.5) / days_in_month;
            break;
        }
        default:
            fraction = 0.5;
    }

    $("<div class='gantt-today-line' title='Today'></div>")
        .css({ left: Math.round(left + width * fraction) + "px" })
        .appendTo($panel);
}

// Current scale, from the number of header rows the library stores on the element
function current_scale(el) {
    return ({ 5: "hours", 4: "days", 3: "weeks", 2: "months" })[el.headerRows] || INITIAL_SCALE;
}

// ---------------------------------------------------------------------------
// 4. Rendering (initial and after collapsing/expanding)
// ---------------------------------------------------------------------------
function render_gantt() {
    const el = document.getElementById(GANTT_ID);

    // Keep the zoom level chosen by the user when re-rendering
    const scale = gantt_state.rendered_once ? current_scale(el) : INITIAL_SCALE;
    gantt_state.rendered_once = true;

    // The library adds a mouse-wheel handler on every render; remove the old
    // one so scrolling does not speed up.
    $(el).off("wheel mousewheel DOMMouseScroll");

    $(el).gantt({
        source: build_gantt_items(gantt_state.milestones, gantt_state.collapsed),
        scale: scale,
        minScale: "days",
        navigate: "scroll",
        itemsPerPage: ITEMS_PER_PAGE,
        onItemClick: function (url) {
            // Only open https links, without giving the new tab access to window.opener
            if (typeof url === "string" && url.startsWith("https://")) {
                window.open(url, "_blank", "noopener,noreferrer");
            }
        },
        onRender: function () {
            draw_today_line(el);
        },
        waitText: ""
    });
}

function build_gantt_chart(id, gantt_data, native_dates) {
    gantt_state.milestones = process_gantt_data(gantt_data, native_dates);

    // Clicking a milestone name collapses/expands its issues. The handler is
    // bound to the container, which is not recreated between renders.
    $(`#${id}`).on("click", ".gantt-ms-toggle", function (e) {
        e.stopPropagation();
        const ms_id = $(this).attr("data-ms-id");
        if (gantt_state.collapsed.has(ms_id)) {
            gantt_state.collapsed.delete(ms_id);
        } else {
            gantt_state.collapsed.add(ms_id);
        }
        render_gantt();
    });

    render_gantt();
}

async function insert_gantt_chart(id, position, gantt_data, native_dates) {
    // create DOM object
    const gantt_object = document.createElement("div");
    gantt_object.setAttribute("id", id);
    position.insertAdjacentElement("beforebegin", gantt_object);

    // build the gantt chart object
    build_gantt_chart(id, gantt_data, native_dates);
}

// ---------------------------------------------------------------------------
// 5. GitLab GraphQL API (same GitLab instance as the current page, so it works
//    on gitlab.com and on self-managed instances)
// ---------------------------------------------------------------------------
const GRAPHQL_URL = window.location.origin + "/api/graphql";

function graphql(query, variables) {
    const headers = { "content-type": "application/json" };
    // Send the page's CSRF token so GitLab accepts the user's session
    const csrf = document.querySelector('meta[name="csrf-token"]');
    if (csrf) headers["X-CSRF-Token"] = csrf.getAttribute("content");

    return fetch(GRAPHQL_URL, {
        method: "POST",
        credentials: "same-origin",
        headers: headers,
        body: JSON.stringify({ query: query, variables: variables })
    }).then(res => res.json());
}

const PROJECT_QUERY = `
    query($fullPath: ID!) {
        project(fullPath: $fullPath) {
          milestones {
            nodes {
              id
              title
              startDate
              dueDate
            }
          }
          issues {
            nodes {
              id
              iid
              state
              milestone {
                id
                title
                startDate
                dueDate
              }
              description
              title
              createdAt
              dueDate
              webUrl
            }
          }
        }
    }
`;

// GitLab's native issue start date lives in the work item "Start and due
// date" widget, which is not exposed on the legacy Issue type. Both queries
// are joined by the issue iid.
const NATIVE_DATES_QUERY = `
    query($fullPath: ID!, $after: String) {
        project(fullPath: $fullPath) {
          workItems(types: [ISSUE], first: 100, after: $after) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              iid
              widgets {
                ... on WorkItemWidgetStartAndDueDate {
                  startDate
                  dueDate
                }
              }
            }
          }
        }
    }
`;

// Read the native dates of all issues (paginated). On any error (e.g. an older
// GitLab without work items) return what was read; the chart then falls back
// to the other start date rules.
async function fetch_native_dates(project_full_path) {
    const dates = {};
    let after = null;
    try {
        for (let page = 0; page < 50; page++) {
            const res = await graphql(NATIVE_DATES_QUERY, { fullPath: project_full_path, after: after });
            if (res.errors) {
                console.warn("Gantt chart: could not read native issue dates:", res.errors);
                break;
            }
            const work_items = res.data && res.data.project && res.data.project.workItems;
            if (!work_items) break;
            work_items.nodes.forEach(function (wi) {
                const widget = (wi.widgets || []).find(w => w && ("startDate" in w || "dueDate" in w));
                if (widget) {
                    dates[wi.iid] = { startDate: widget.startDate, dueDate: widget.dueDate };
                }
            });
            if (!work_items.pageInfo.hasNextPage) break;
            after = work_items.pageInfo.endCursor;
        }
    } catch (e) {
        console.warn("Gantt chart: error while reading native issue dates:", e);
    }
    return dates;
}

$(function () {
    // The path looks like "/group/subgroup/project/-/milestones": everything
    // before "/-/" is the project full path (subgroups included).
    const project_full_path = window.location.pathname.split("/-/")[0].substring(1);
    const position = document.querySelector("#content-body > div.milestones");
    if (!position) return;

    Promise.all([
        graphql(PROJECT_QUERY, { fullPath: project_full_path }),
        fetch_native_dates(project_full_path)
    ]).then(function ([res, native_dates]) {
        if (res.errors || !res.data || !res.data.project) {
            // e.g. a group milestones page, or a project the user cannot read
            console.warn("Gantt chart: could not load project data:", res.errors);
            return;
        }
        insert_gantt_chart(GANTT_ID, position, res.data, native_dates);
    }).catch(function (e) {
        console.warn("Gantt chart: request failed:", e);
    });
});
