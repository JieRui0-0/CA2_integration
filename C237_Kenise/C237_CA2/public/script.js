window.onload = function() {
    console.log("Page Loaded Successfully");
    alert("Welcome to the Community Events Page!");
};

document.querySelectorAll('button').forEach(button => {
    button.addEventListener('click', function() {
        alert("You clicked a button!");
    });
});
