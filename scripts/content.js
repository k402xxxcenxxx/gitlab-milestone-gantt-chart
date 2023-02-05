function parse_issues_items(issue_page) {
    const issue_items = []
    const issue_list = issue_page.querySelectorAll("ul.issues-list > li")

    issue_list.forEach(
        function(issue, currentIndex, listObj) {
            const issue_item = {
                "id": `issue-${currentIndex}`,
                "tooltip": null
            }

            const title = issue.querySelector("div > div.issuable-main-info > div.issue-title.title > span > a")
            const start_date = issue.querySelector("div > div.issuable-main-info > div.issuable-info > span.issuable-authored > time")
            const due_date = issue.querySelector("div > div.issuable-main-info > div.issuable-info > span.issuable-due-date")

            if (title) {
                issue_item.name = title.innerText
            }

            if (start_date && due_date) {
                issue_item.values = [
                    {
                        from: start_date.innerText,
                        to: due_date.innerText,
                        label: title.innerText,
                    }
                ]
            }

            issue_items.push(issue_item);
        }
    );
    return issue_items;
}

function build_gantt_chart(chart_id, task_list) {
    $(`#${chart_id}`).gantt({
        source: task_list,
        scale: "weeks",
        minScale: "days",
        navigate: "scroll"
    });

    $(".fn-gantt .dataPanel").css("background-image", `url(${chrome.runtime.getURL("images/grid.png")})`)
    $(".fn-gantt .navigate .nav-slider-button").css("background", `url(${chrome.runtime.getURL("images/slider_handle.png")}) center center no-repeat;`)
    $(".fn-gantt .nav-link").css("background", `#595959 url(${chrome.runtime.getURL("images/icon_sprite.png")}) !important;`)
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
                fetch(issue_url, {
                    headers: {
                        'Accept': 'application/json',
                    }
                }).then(r => r.json()).then(issue_page_content => {
                    const parser = new DOMParser();
                    const issue_page = parser.parseFromString(issue_page_content.html, 'text/html');

                    // parse issue items
                    const issue_items = parse_issues_items(issue_page)

                    // insert the gantt after each milestone
                    const gantt_object = document.createElement("div");
                    gantt_object.setAttribute("id", `gantt-chart-${currentIndex}`);
                    // gantt_object.textContent = issue_items.toString()
                    milestone.insertAdjacentElement("afterend", gantt_object);

                    // draw and build the gantt chart object
                    build_gantt_chart(`gantt-chart-${currentIndex}`, issue_items)
                })
            }
        );
    }

});