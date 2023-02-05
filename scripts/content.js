function parse_issues_items(issue_page) {
    const issue_items = []
    const issue_list = issue_page.querySelectorAll("ul.issues-list > li")

    issue_list.forEach(
        function(issue, currentIndex, listObj) {
            const issue_item = {}
            const title = issue.querySelector("div > div.issuable-main-info > div.issue-title.title > span > a")
            const due_date = issue.querySelector("div > div.issuable-main-info > div.issuable-info > span.issuable-due-date")

            if (title) {
                issue_item.title = title.innerText
            }

            if (due_date) {
                issue_item.due_date = due_date.innerText
            }

            issue_items.push(issue_item);
        }
    );
    return issue_items;
}

function build_gantt_chart(task_list) {
    const gantt_chart_object = document.createElement("div");
    task_list.forEach(
        function (task, currentIndex, listObj) {
            const task_object = document.createElement("div");
            task_object.textContent = `${currentIndex}.${task.title} : due_date ${task.due_date}`;
            gantt_chart_object.appendChild(task_object)
        }
    );
    return gantt_chart_object
}

const milestone_list = document.querySelectorAll("#content-body > div.milestones > ul > li");

// `document.querySelectorAll` may return empty NodeList if the selector doesn't match anything.
if (milestone_list.length > 0) {
    milestone_list.forEach(
        function (milestone, currentIndex, listObj) {
            const issue_link = milestone.querySelector("div > div.milestone-progress > a:nth-child(2)")
            const issue_url = issue_link.getAttribute('href');
            fetch(issue_url, {
                headers: {
                    'Accept': 'application/json',
                }
            }).then(r => r.json()).then(issue_page_content => {
                const parser = new DOMParser();
	            const issue_page = parser.parseFromString(issue_page_content.html, 'text/html');

                // parse issue items
                const issue_items = parse_issues_items(issue_page)

                // draw and build the gantt chart object
                const gantt_chart_object = build_gantt_chart(issue_items)

                // insert the object after each milestone
                milestone.insertAdjacentElement("afterend", gantt_chart_object);
            })
        }
    );
}