async function _parse_issue_item(issue, currentIndex) {
    let issue_item = null;

    const title = issue.querySelector("div > div.issuable-main-info > div.issue-title.title > span > a")
    const due_date_string = issue.querySelector("div > div.issuable-main-info > div.issuable-info > span.issuable-due-date")

    if (title && due_date_string) {
        const issue_item_url = title.getAttribute('href')
        const response = await fetch(issue_item_url, {
            headers: {
                'Accept': 'application/json',
            }
        })
        const issue_page_content = await response.json();

        // parse issue items
        const issue_description = issue_page_content["description"]
        const start_date_re = new RegExp(/^\/start_date\ *(\d{4}\/(0?[1-9]|1[012])\/(0?[1-9]|[12][0-9]|3[01])*)/g);
        const start_date_pattern = start_date_re.exec(issue_description)

        if (start_date_pattern) {
            const start_date = start_date_pattern[1]
            const due_date = new Date(due_date_string.innerText)

            issue_item = {
                id: `issue-${currentIndex}`,
                name: title.innerText,
                values: [
                    {
                        from: start_date,
                        to: due_date.toLocaleDateString('zh-Hans-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }),
                        label: title.innerText,
                        desc: issue_description,
                        dataObj: issue_item_url
                    }
                ],
            }
        }
    }
    return issue_item;
}

async function parse_issues_items(issue_page) {
    let issue_items = []
    const issue_list = issue_page.querySelectorAll("ul.issues-list > li")

    for (let index = 0; index < issue_list.length; index++) {
        const issue_item = await _parse_issue_item(issue_list[index], index);
        if (issue_item) {
            issue_items.push(issue_item);
        }
    }

    return issue_items;
}

function build_gantt_chart(id, gantt_items) {
    $(`#${id}`).gantt({
        source: gantt_items,
        scale: "weeks",
        minScale: "days",
        navigate: "scroll",
        onItemClick: function(url) {
            window.open(url, "_blank");
        }
    });
}

async function get_issue_items(issue_url) {
    let issue_items = [];

    const response = await fetch(issue_url, {
        headers: {
            'Accept': 'application/json',
        }
    })
    const issue_list_content = await response.json();
    const parser = new DOMParser();
    const issue_page = parser.parseFromString(issue_list_content.html, 'text/html');

    // parse issue items
    issue_items = await parse_issues_items(issue_page)
    return issue_items
}

async function insert_gantt_chart(id, position, issue_url) {
    // create DOM object
    const gantt_object = document.createElement("div");
    gantt_object.setAttribute("id", id);
    position.insertAdjacentElement("afterend", gantt_object);

    // collect gantt items
    const gantt_items = await get_issue_items(issue_url);

    // build the gantt chart object
    build_gantt_chart(id, gantt_items)
}

$(function() {
    // get all milestone list in this page
    const milestone_list = document.querySelectorAll("#content-body > div.milestones > ul > li");
    if (milestone_list.length > 0) {

        // create gantt chart for each milestone
        milestone_list.forEach(
            function (milestone, currentIndex, listObj) {
                const issue_link = milestone.querySelector("div > div.milestone-progress > a:nth-child(2)")
                const issue_url = issue_link.getAttribute('href');

                // insert the gantt after each milestone
                insert_gantt_chart(`gantt-chart-${currentIndex}`, milestone, issue_url);
            }
        );
    }
});