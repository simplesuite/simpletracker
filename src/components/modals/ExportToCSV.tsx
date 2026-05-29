import React from 'react';
import TextField from "@mui/material/TextField";
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Grid from '@mui/material/Grid';
import { useModalStore } from '../../store/modalStore';
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { dialogPaperStyles, useGlobalStore } from "../../store/globalStore";
import { useTableStore } from "../../store/tableStore";
import CloseIcon from '@mui/icons-material/Close';
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import DownloadIcon from '@mui/icons-material/Download';
import dayjs, { Dayjs } from 'dayjs';
import { supaCategories, supaSections, supaTransactionsFromCategories } from "../extras/api_functions";
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { CSVLink } from "react-csv";

export default function ExportToCSV() {
    const setLoadingOpen = useGlobalStore(s => s.setMainLoading);
    const [fromMonth, setFromMonth] = React.useState<Dayjs | null>(dayjs());
    const [toMonth, setToMonth] = React.useState<Dayjs | null>(dayjs());
    const exportCSV = useModalStore(s => s.exportToCSV);
    const setExportCSV = useModalStore(s => s.setExportToCSV);
    const currentBudget = useTableStore(s => s.currentBudgetAndMonth);
    const setSnackText = useGlobalStore(s => s.setSnackBarText);
    const setSnackSev = useGlobalStore(s => s.setSnackBarSeverity);
    const setSnackOpen = useGlobalStore(s => s.setSnackBarOpen);
    const [allExportData, setAllExportData] = React.useState<any[]>([]);
    const [generated, setGenerated] = React.useState(false);
    const [errorText, setErrorText] = React.useState('');
    const theme = useTheme();
    const bigger = useMediaQuery(theme.breakpoints.up('sm'));

    const verifyInputs = () => {
        if (fromMonth === null) {
            setErrorText('Please enter a from month');
            return false;
        }
        if (toMonth === null) {
            setErrorText('Please enter a to month');
            return false;
        }
        if (fromMonth.isAfter(toMonth)) {
            setErrorText('Please enter in the correct order');
            return false;
        }
        return true;
    };

    async function handleSubmit(event: any) {
        event.preventDefault();
        setErrorText('');
        if (!verifyInputs()) return;

        setLoadingOpen(true);
        try {
            // Build list of months to fetch
            const months: { year: string; month: string }[] = [];
            const start = dayjs(fromMonth);
            const end = dayjs(toMonth);
            for (let m = dayjs(start); m.isBefore(end) || m.isSame(end, 'month'); m = m.add(1, 'month')) {
                months.push({ year: m.format('YYYY'), month: m.format('MMMM') });
            }

            // Fetch all sections sequentially (each month is a separate query)
            const allSections: any[] = [];
            for (const m of months) {
                const sections = await supaSections(currentBudget.budgetID, m.month, m.year);
                if (sections) {
                    allSections.push(...sections);
                }
            }

            if (allSections.length === 0) {
                setErrorText('No data found for the selected months');
                setLoadingOpen(false);
                return;
            }

            // Fetch all categories for those sections
            const allCategories = await supaCategories(allSections.map(s => s.recordID));
            if (!allCategories || allCategories.length === 0) {
                setErrorText('No categories found');
                setLoadingOpen(false);
                return;
            }

            // Fetch all transactions for those categories
            const allTransactions = await supaTransactionsFromCategories(allCategories.map(c => c.recordID));

            // Build export rows
            const exportRows = (allTransactions || []).map((tx: any) => {
                const category = allCategories.find(c => c.recordID === tx.categoryID);
                const section = category
                    ? allSections.find(s => s.recordID === category.sectionID)
                    : null;
                return {
                    budgetYear: section?.sectionYear ?? '',
                    budgetMonth: section?.sectionMonth ?? '',
                    sectionName: section?.sectionName ?? '',
                    sectionType: section?.sectionType ?? '',
                    categoryName: category?.categoryName ?? '',
                    categoryBudgeted: section?.sectionType === 'expense' ? -category?.amount : category?.amount,
                    transactionDate: dayjs(tx.transactionDate).format('MM/DD/YYYY'),
                    transactionType: tx.transactionType,
                    transactionAmount: tx.transactionType === 'expense' ? -tx.amount : tx.amount,
                    transactionTitle: tx.title,
                };
            });

            setAllExportData(exportRows);
            setGenerated(true);
            setSnackSev('success');
            setSnackText('Export generated!');
            setSnackOpen(true);
        } catch (err) {
            console.error('Export error:', err);
            setErrorText('Something went wrong generating the export');
        } finally {
            setLoadingOpen(false);
        }
    }

    React.useEffect(() => {
        if (exportCSV) return;
        setGenerated(false);
        setAllExportData([]);
        setErrorText('');
    }, [exportCSV]);

    return (
        <Dialog open={exportCSV}
            onClose={() => setExportCSV(false)}
            scroll='paper'
            fullScreen={!bigger}
            slotProps={{ paper: bigger ? dialogPaperStyles : undefined }}
        >
            <Box sx={{ bgcolor: 'background.paper', height: '100%' }} component='form' onSubmit={handleSubmit}>
                <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    Export Data to CSV <IconButton onClick={() => setExportCSV(false)}><CloseIcon /></IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    <Grid container spacing={2}>
                        <Typography>Select the start and end months of the data you want</Typography>
                        <LocalizationProvider dateAdapter={AdapterDayjs}>
                            <Grid size={12}>
                                <DatePicker
                                    views={['year', 'month']}
                                    label="Start Month"
                                    value={fromMonth}
                                    onChange={(newValue) => setFromMonth(newValue)}
                                    slotProps={{
                                        textField: (params) => <TextField {...params} fullWidth helperText={null} />,
                                    }}
                                    sx={{ width: '100%' }}
                                />
                            </Grid>
                            <Grid size={12}>
                                <DatePicker
                                    views={['year', 'month']}
                                    label="End Month"
                                    value={toMonth}
                                    onChange={(newValue) => setToMonth(newValue)}
                                    slotProps={{
                                        textField: (params) => <TextField {...params} fullWidth helperText={null} />,
                                    }}
                                    sx={{ width: '100%' }}
                                />
                            </Grid>
                        </LocalizationProvider>
                    </Grid>
                </DialogContent>
                <Box sx={{ mx: 1, mt: 0.5 }}><Typography color='error'>{errorText}</Typography></Box>
                <DialogActions>
                    {generated ?
                        <CSVLink
                            data={allExportData}
                            filename={"budgetData.csv"}
                            onClick={() => setExportCSV(false)}
                            className="MuiButtonBase-root MuiButton-root MuiButton-contained MuiButton-containedPrimary"
                            target="_blank"
                        >
                            Download Export
                        </CSVLink>
                        :
                        <Button fullWidth startIcon={<DownloadIcon />} type='submit' variant='contained'>Export</Button>
                    }
                </DialogActions>
            </Box>
        </Dialog>
    );
}
