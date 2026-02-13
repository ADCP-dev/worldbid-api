<script setup lang="ts">
const content = ref("<h3>Welcome to the Rich Editor</h3><p>This is a <b>modularized</b> rich text editor component.</p><ul><li>Supports lists</li><li>Bold/Italic</li><li>Headings</li></ul>");
</script>

<template>
    <div class="container mx-auto py-10">
        <div class="flex flex-col gap-4">
            <div>
                <h2 class="text-2xl font-bold tracking-tight">Rich Editor Demo</h2>
                <p class="text-muted-foreground">
                    Using the modularized RichEditor component with Tiptap.
                </p>
            </div>

            <div class="grid gap-4 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Editor</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <RichEditor v-model="content" class="min-h-[300px]" />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Preview (v-model)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div class="prose dark:prose-invert p-4 border rounded-md min-h-[300px] bg-muted/50">
                            <div v-html="content"></div>
                        </div>
                        <div class="mt-4">
                            <h4 class="text-sm font-medium mb-2">Raw HTML:</h4>
                            <pre
                                class="bg-slate-950 text-slate-50 p-4 rounded-md text-xs overflow-auto max-h-[200px]">{{ content }}</pre>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    </div>
</template>
