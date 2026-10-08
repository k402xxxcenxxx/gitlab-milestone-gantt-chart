// Escape HTML special characters. jquery.fn.gantt concatenates label, desc and
// name directly into HTML, so any text coming from GitLab must be escaped to
// prevent XSS (e.g. an issue title such as <img src=x onerror=...>).
function escape_html(value) {
    return String(value ?? "").replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
}

function build_gantt_chart(id, gantt_data) {
    let milestone_dict = {}
    gantt_data.project.milestones.nodes.forEach(
        function (milestone, currentIndex, listObj) {
            milestone_dict[milestone.id] = {
                title: milestone.title,
                issue_list: []
            };
        }
    );

    gantt_data.project.issues.nodes.forEach(
        function (issue, currentIndex, listObj) {
            if (issue.milestone == null || milestone_dict[issue.milestone.id] == undefined) {
                return;
            }
            // parse start date
            const start_date_re = new RegExp(/^\/start_date\ *(\d{4}\/(0?[1-9]|1[012])\/(0?[1-9]|[12][0-9]|3[01])*)/g);
            const start_date_pattern = start_date_re.exec(issue.description);
            let start_date = issue.createdAt;
            if (start_date_pattern) {
                start_date = start_date_pattern[1];
            }

            milestone_dict[issue.milestone.id].issue_list.push({
                id: issue.id,
                desc: escape_html(issue.description),
                values: [
                    {
                        from: start_date,
                        to: issue.dueDate,
                        label: escape_html(issue.title),
                        desc: escape_html(issue.description),
                        dataObj: issue.webUrl
                    }
                ]
            });
        }
    );

    gantt_items = []
    Object.keys(milestone_dict).forEach(
        function (milestone_id, currentIndex, listObj) {
            if (milestone_dict[milestone_id].issue_list.length > 0) {
                milestone_dict[milestone_id].issue_list[0].name = escape_html(milestone_dict[milestone_id].title);
            } else {
                milestone_dict[milestone_id].issue_list = [{
                    id: milestone_id,
                    name: escape_html(milestone_dict[milestone_id].title),
                    values: []
                }]
            }
            gantt_items.push(...milestone_dict[milestone_id].issue_list);
        }
    );

    $(`#${id}`).gantt({
        source: gantt_items,
        scale: "weeks",
        minScale: "days",
        navigate: "scroll",
        onItemClick: function(url) {
            // Only open https links, without giving the new tab access to window.opener
            if (typeof url === "string" && url.startsWith("https://")) {
                window.open(url, "_blank", "noopener,noreferrer");
            }
        },
        waitText: ""
    });
}


async function insert_gantt_chart(id, position, gantt_items) {
    // create DOM object
    const gantt_object = document.createElement("div");
    gantt_object.setAttribute("id", id);
    position.insertAdjacentElement("beforebegin", gantt_object);

    // build the gantt chart object
    build_gantt_chart(id, gantt_items);
}

$(function() {
    const current_url = window.location.href;
    const project_full_path = current_url.split('/').slice(3, 5).join('/');
    console.log(project_full_path);
    fetch('https://gitlab.com/api/graphql', {
        method: 'POST',
        headers: {
            "content-type": "application/json"
        },
        body: JSON.stringify({
            // Pass the project path as a GraphQL variable instead of
            // interpolating it into the query string
            variables: { fullPath: project_full_path },
            query: `
                query($fullPath: ID!) {
                    project(fullPath: $fullPath) {
                      milestones {
                        nodes {
                          id
                          title
                        }
                      }
                      issues {
                        nodes {
                          milestone {
                            id
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
            `
        })
    })
    .then(res => res.json())
    .then(res => {
        insert_gantt_chart(`gantt-chart`, document.querySelector("#content-body > div.milestones"), res.data);
    });
});
