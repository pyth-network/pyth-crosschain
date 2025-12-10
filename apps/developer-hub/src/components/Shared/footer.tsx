export const PageFooter = () => {
    return (
        <footer style={{ padding: "1.5rem", display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
            <p style={{ opacity: 0.7, fontSize: '0.875rem' }}>&copy; {new Date().getFullYear()} Pyth Network. All rights reserved.</p>
            <p style={{ opacity: 0.7, fontSize: '0.875rem' }}>Privacy Policy | Terms of Use</p>
        </footer>
    )
}