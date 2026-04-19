document.addEventListener("DOMContentLoaded", async () => {
    const form = document.getElementById("updateForm");

    if (!form) {
        return;
    }

    const notify = (message, type = "info") => {
        if (window.showFormMessage) {
            window.showFormMessage(form, message, type);
            return;
        }

        if (window.showToast) {
            window.showToast(message, type);
            return;
        }

        window["alert"](message);
    };

    try {
        const response = await fetch("/api/currentUser", {
            credentials: "same-origin",
            headers: {
                "Accept": "application/json"
            }
        });
        const user = await response.json();

        if (!response.ok) {
            throw new Error(user.message || "Unable to load user details.");
        }

        document.getElementById("fullName").value = user.u_name || "";
        document.getElementById("age").value = user.u_age || "";
        document.getElementById("phone").value = user.u_mobno || "";
        document.getElementById("address").value = user.u_address || "";
        document.getElementById("email").value = user.u_mailid || "";
        document.getElementById("dob").value = user.u_dob || "";

        if (user.u_gender === "male") {
            document.getElementById("male").checked = true;
        }

        if (user.u_gender === "female") {
            document.getElementById("female").checked = true;
        }
    } catch (error) {
        console.error(error);
        notify(error.message || "Unable to load your profile.", "error");
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        notify("Saving your profile...", "info");

        const payload = {
            u_name: form.querySelector('[name="u_name"]').value.trim(),
            u_age: form.querySelector('[name="u_age"]').value.trim(),
            u_mobno: form.querySelector('[name="u_mobno"]').value.trim(),
            u_address: form.querySelector('[name="u_address"]').value.trim(),
            u_mailid: form.querySelector('[name="u_mailid"]').value.trim(),
            u_gender: form.querySelector('input[name="u_gender"]:checked')?.value || "",
            u_dob: form.querySelector('[name="u_dob"]').value
        };

        try {
            const response = await fetch("/editUser", {
                method: "POST",
                credentials: "same-origin",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            const contentType = response.headers.get("content-type") || "";
            const data = contentType.includes("application/json")
                ? await response.json()
                : { message: await response.text() };

            if (!response.ok) {
                throw new Error(data.message || "Unable to update your profile.");
            }

            notify(`${data.message || "Profile updated successfully."} Redirecting...`, "success");
            setTimeout(() => {
                window.location.href = data.redirectUrl || "/UserMain.html";
            }, 700);
        } catch (error) {
            console.error(error);
            notify(error.message || "Unable to update your profile.", "error");
        }
    });
});
