import { useRouteError, isRouteErrorResponse } from "react-router-dom";

export default function ErrorPage() {
    const error = useRouteError();
    console.error(error);

    let message = 'An unexpected error has occurred.';
    if (isRouteErrorResponse(error)) {
        message = error.statusText || error.data;
    } else if (error instanceof Error) {
        message = error.message;
    }

    return (
        <div id="error-page" style={{ textAlign: 'center', padding: '2rem' }}>
            <h1>Oops!</h1>
            <p>Sorry, something went wrong.</p>
            <p><i>{message}</i></p>
        </div>
    );
}
