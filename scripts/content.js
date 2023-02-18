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
                desc: title.innerText,
                values: [
                    {
                        from: start_date,
                        to: due_date.toLocaleDateString('zh-Hans-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }),
                        label: title.innerText,
                        desc: issue_description,
                        dataObj: issue_item_url
                    }
                ]
            }
        }
    }
    return issue_item;
}

async function parse_issues_items(issue_page, prefix) {
    let issue_items = []
    const issue_list = issue_page.querySelectorAll("ul.issues-list > li");

    for (let index = 0; index < issue_list.length; index++) {
        const issue_item = await _parse_issue_item(issue_list[index], `${prefix}-${index}`);
        if (issue_item) {
            issue_items.push(issue_item);
        }
    }
    return issue_items
}

function build_gantt_chart(id, gantt_items) {
    $(`#${id}`).gantt({
        source: gantt_items,
        scale: "weeks",
        minScale: "days",
        navigate: "scroll",
        onItemClick: function(url) {
            window.open(url, "_blank");
        },
        waitText: ""
    });
}

async function get_gantt_items(milestone_url_list) {
    let gantt_items = [];
    for (let index = 0; index < milestone_url_list.length; index++) {
        const milestone_item = milestone_url_list[index];

        const response = await fetch(milestone_item.url, {
            headers: {
                'Accept': 'application/json',
            }
        })
        const issue_list_content = await response.json();
        const parser = new DOMParser();
        const issue_page = parser.parseFromString(issue_list_content.html, 'text/html');

        // parse issue items
        let issue_items = await parse_issues_items(issue_page, index);
        if (issue_items.length > 0) {
            issue_items[0].name = milestone_item.title;
        } else {
            issue_items = [{
                id: `issue-${index}`,
                name: milestone_item.title,
                values: []
            }]
        }
        gantt_items.push(...issue_items);
    }
    return gantt_items
}

async function insert_gantt_chart(id, position, milestone_url_list) {
    // create DOM object
    const gantt_object = document.createElement("div");
    gantt_object.setAttribute("id", id);
    position.insertAdjacentElement("beforebegin", gantt_object);

    // collect gantt items
    const gantt_items = await get_gantt_items(milestone_url_list);

    // build the gantt chart object
    build_gantt_chart(id, gantt_items)
}

$(function() {
    // get all milestone list in this page
    const milestone_list = document.querySelectorAll("#content-body > div.milestones > ul > li");
    if (milestone_list.length > 0) {

        milestone_url_list = []

        // create gantt chart for each milestone
        milestone_list.forEach(
            function (milestone, currentIndex, listObj) {
                const milestone_link = milestone.querySelector("div > div.milestone-progress > a:nth-child(2)")
                const milestone_url = milestone_link.getAttribute('href');
                const milestone_title = milestone.querySelector("div > div > div:nth-child(1) > strong > a").innerText;
                milestone_url_list.push({
                    title: milestone_title,
                    url: milestone_url
                })
            }
        );

        // insert the gantt on the top
        insert_gantt_chart(`gantt-chart`, document.querySelector("#content-body > div.milestones"), milestone_url_list);
    }
});