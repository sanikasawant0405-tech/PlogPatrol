const loginForm = document.getElementById("loginForm");

function notify(message, type = "info") {
    if (window.showFormMessage) {
        window.showFormMessage(loginForm, message, type);
        return;
    }

    if (window.showToast) {
        window.showToast(message, type);
        return;
    }

    window["alert"](message);
}

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    notify("Checking your login...", "info");

    const username = document.querySelector('[name="username"]').value.trim();
    const password = document.querySelector('[name="password"]').value;

    try {
        const response = await fetch("/UserLogin", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            notify(`${data.message || "Login successful."} Redirecting...`, "success");
            localStorage.setItem("userUid", data.userUid);
            setTimeout(() => {
                window.location.href = data.redirectUrl || "/UserMain.html";
            }, 650);
        } else {
            notify(data.message || "Login failed.", "error");
        }
    } catch (error) {
        console.error(error);
        notify("Login failed. Please make sure the server is running.", "error");
    }
});
