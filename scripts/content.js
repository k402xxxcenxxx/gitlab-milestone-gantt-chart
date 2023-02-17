function parse_issues_items(issue_page) {
    const issue_items = []
    const issue_list = issue_page.querySelectorAll("ul.issues-list > li")

    issue_list.forEach(
        async function(issue, currentIndex, listObj) {
            const title = issue.querySelector("div > div.issuable-main-info > div.issue-title.title > span > a")
            const due_date_string = issue.querySelector("div > div.issuable-main-info > div.issuable-info > span.issuable-due-date")

            if (title && due_date_string) {

                const issue_url = title.getAttribute('href')
                const get_issue_response = fetch(issue_url, {
                    headers: {
                        'Accept': 'application/json',
                    }
                })
                const issue_page_content = get_issue_response.json()

                // parse issue items
                const issue_description = issue_page_content["description"]
                const start_date_re = new RegExp(/^\/start_date\ *(\d{4}\/(0?[1-9]|1[012])\/(0?[1-9]|[12][0-9]|3[01])*)/g);
                const start_date_pattern = start_date_re.exec(issue_description)

                if (start_date_pattern) {
                    const start_date = start_date_pattern[1]
                    const due_date = new Date(due_date_string.innerText)
                    var issue_item = {
                        "id": `issue-${currentIndex}`,
                        "name": title.innerText,
                        "tooltip": null,
                        "values": [
                            {
                                from: start_date,
                                to: due_date.toLocaleDateString('zh-Hans-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }),
                                label: title.innerText,
                            }
                        ]
                    }
                    issue_items.push(issue_item);
                }
            }
        }
    );
    console.log(issue_items)
    return issue_items;
}

function build_gantt_chart(chart_id, issue_url) {

    const task_list = get_issue_items(issue_url);
    console.log(task_list)

    $(`#${chart_id}`).gantt({
        source: task_list,
        scale: "weeks",
        minScale: "days",
        navigate: "scroll"
    });
}

async function get_issue_items(issue_url) {
    const get_issue_list_response = await fetch(issue_url, {
        headers: {
            'Accept': 'application/json',
        }
    })
    const issue_list_content = get_issue_list_response.json();
    const parser = new DOMParser();
    const issue_page = parser.parseFromString(issue_list_content.html, 'text/html');

    // parse issue items
    const issue_items = parse_issues_items(issue_page)
    return issue_items
}

$(function() {

    "use strict";

    const milestone_list = document.querySelectorAll("#content-body > div.milestones > ul > li");

    // `document.querySelectorAll` may return empty NodeList if the selector doesn't match anything.
    if (milestone_list.length > 0) {
        milestone_list.forEach(
            function (milestone, currentIndex, listObj) {
                const issue_link = milestone.querySelector("div > div.milestone-progress > a:nth-child(2)")
                const issue_url = issue_link.getAttribute('href');
             
                // insert the gantt after each milestone
                const gantt_object = document.createElement("div");
                gantt_object.setAttribute("id", `gantt-chart-${currentIndex}`);
                milestone.insertAdjacentElement("afterend", gantt_object);

                // draw and build the gantt chart object
                build_gantt_chart(`gantt-chart-${currentIndex}`, issue_url)
            }
        );
    }

});