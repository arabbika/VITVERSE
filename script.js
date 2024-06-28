function showChildButtons(category) {
    document.querySelectorAll('.child-buttons').forEach(div => {
        div.style.display = 'none';
    });
    document.querySelector(`#${category}`).style.display = 'flex';
}
