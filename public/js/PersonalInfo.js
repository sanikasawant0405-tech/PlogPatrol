document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector("form");

    if (!form) {
        return;
    }

    const hasField = (name) => Boolean(form.querySelector(`[name="${name}"]`));
    const isDonorForm = hasField("d_name");
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

    const getValue = (name) => {
        const field = form.querySelector(`[name="${name}"]`);
        return field ? field.value.trim() : "";
    };

    const getCheckedValue = (name) => {
        const field = form.querySelector(`[name="${name}"]:checked`);
        return field ? field.value : "";
    };

    const buildPayload = () => {
        if (isDonorForm) {
            return {
                d_name: getValue("d_name"),
                d_age: getValue("d_age"),
                d_mobno: getValue("d_mobno"),
                d_mailid: getValue("d_mailid"),
                d_gender: getCheckedValue("d_gender"),
                d_dob: getValue("d_dob")
            };
        }

        return {
            u_name: getValue("u_name"),
            u_age: getValue("u_age"),
            u_mobno: getValue("u_mobno"),
            u_address: getValue("u_address"),
            u_mailid: getValue("u_mailid"),
            u_gender: getCheckedValue("u_gender"),
            u_dob: getValue("u_dob")
        };
    };

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const endpoint = isDonorForm ? "/donorPersonalInfo" : "/api/submitPersonalInfo";
        notify("Saving your information...", "info");

        try {
            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(buildPayload())
            });

            const contentType = response.headers.get("content-type") || "";
            const data = contentType.includes("application/json")
                ? await response.json()
                : { message: await response.text() };

            if (!response.ok) {
                throw new Error(data.message || "Unable to save personal information.");
            }

            notify(`${data.message || "Personal information saved successfully."} Redirecting...`, "success");
            setTimeout(() => {
                window.location.href = data.redirectUrl || (isDonorForm ? "/DonorMain.html" : "/display");
            }, 700);
        } catch (error) {
            console.error(error);
            notify(error.message || "Error saving personal information.", "error");
        }
    });
});
