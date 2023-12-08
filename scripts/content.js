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
            // parse start date
            const start_date_re = new RegExp(/^\/start_date\ *(\d{4}\/(0?[1-9]|1[012])\/(0?[1-9]|[12][0-9]|3[01])*)/g);
            const start_date_pattern = start_date_re.exec(issue.description);
            let start_date = issue.createdAt;
            if (start_date_pattern) {
                start_date = start_date_pattern[1];
            }

            milestone_dict[issue.milestone.id].issue_list.push({
                id: issue.id,
                desc: issue.description,
                values: [
                    {
                        from: start_date,
                        to: issue.dueDate,
                        label: issue.title,
                        desc: issue.description,
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
                milestone_dict[milestone_id].issue_list[0].name = milestone_dict[milestone_id].title;
            } else {
                milestone_dict[milestone_id].issue_list = [{
                    id: milestone_id,
                    name: milestone_dict[milestone_id].title,
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
            window.open(url, "_blank");
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
            query: `
                query {
                    project(fullPath: "${project_full_path}") {
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
