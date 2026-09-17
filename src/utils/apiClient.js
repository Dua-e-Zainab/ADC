import axios  from "axios";

const apiClient = axios.create({
    baseURL: "/api",
    withCredentials: true,
});

apiClient.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err.response?.status === 401) {
            // window.location.reload();
        }
        return Promise.reject(err);
    }
);

export default apiClient;