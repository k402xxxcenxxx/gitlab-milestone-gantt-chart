# gitlab-milestone-gantt-chart
This repo is to develop a chrome extension that help user transfer gitlab milestone to gantt chart

## Features

- Works on gitlab.com and on self-managed GitLab instances (it uses the GitLab of the current page).
- One row per milestone showing only its start and due dates, followed by its issues.
  Click the milestone name to collapse or expand its issues.
- Open and closed issues have different colors.
- A red vertical line marks the current day.
- Issues without a milestone are shown in a "No milestone" group at the end.
- All rows are shown on a single page.

## Issue dates

The start date of each issue is taken from, in order:

1. GitLab's native **Start date** field (work items);
2. a line `/start_date YYYY-MM-DD` (or `YYYY/MM/DD`) in the issue description;
3. the start date of the issue's milestone;
4. the date the issue was created.

The end of the bar is the issue's due date. Without one, the bar is one day long.

## License

This project is licensed under the [MIT License](LICENSE).
