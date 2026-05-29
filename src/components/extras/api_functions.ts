import { supabase } from "../../lib/supabase";

export const supaBudgetsByCreator = async (userID: string) => {
    const { data, error } = await supabase
        .from('budgets')
        .select()
        .eq('creatorID', userID);
    if (error) console.error('supaBudgetsByCreator:', error.message);
    return data;
};

export const supaBudgetsByID = async (value: string[]) => {
    const { data, error } = await supabase
        .from('budgets')
        .select()
        .in('recordID', value);
    if (error) console.error('supaBudgetsByID:', error.message);
    return { data, error };
};

export const supaCategories = async (sectionIDs: string[]) => {
    const { data, error } = await supabase
        .from('categories')
        .select()
        .in('sectionID', sectionIDs);
    if (error) console.error('supaCategories:', error.message);
    return data;
};

export const supaSections = async (budgetID: string, month: string, year: number | string) => {
    const { data, error } = await supabase
        .from('sections')
        .select()
        .eq('budgetID', budgetID)
        .eq('sectionMonth', month)
        .eq('sectionYear', year);
    if (error) console.error('supaSections:', error.message);
    return data;
};

export const supaALLsections = async (budgetID: string) => {
    const { data, error } = await supabase
        .from('sections')
        .select()
        .eq('budgetID', budgetID);
    if (error) console.error('supaALLsections:', error.message);
    return data;
};

export const supaTransactionsFromCategories = async (categoryIDs: string[]) => {
    const { data, error } = await supabase
        .from('transactions')
        .select()
        .in('categoryID', categoryIDs);
    if (error) console.error('supaTransactionsFromCategories:', error.message);
    return data;
};

export const supaTransactions = async (budgetID: string) => {
    const { data, error } = await supabase
        .from('transactions')
        .select()
        .eq('budgetID', budgetID)
        .is('categoryID', null);
    if (error) console.error('supaTransactions:', error.message);
    return data;
};

export const supaShared = async (value: string) => {
    const { data, error } = await supabase
        .from('shared')
        .select('budgetID')
        .eq('sharedToID', value);
    if (error) console.error('supaShared:', error.message);
    return data;
};

export const supaUsers = async () => {
    const { data, error } = await supabase
        .from('users')
        .select();
    if (error) console.error('supaUsers:', error.message);
    return data;
};
