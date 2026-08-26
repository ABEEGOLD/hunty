"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getCreatorProfile, setCreatorProfile } from "@/lib/creatorProfiles";

const profileFormSchema = z.object({
  bio: z.string().max(300, "Bio must not be longer than 300 characters.").optional(),
  links: z
    .array(
      z.object({
        title: z.string().min(1, "Title is required."),
        url: z.string().url("Please enter a valid URL."),
      })
    )
    .optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

interface CreatorProfileSettingsProps {
  address: string;
}

export function CreatorProfileSettings({ address }: CreatorProfileSettingsProps) {
  const [open, setOpen] = useState(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      bio: "",
      links: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    name: "links",
    control: form.control,
  });

  useEffect(() => {
    if (open) {
      const profile = getCreatorProfile(address);
      form.reset({
        bio: profile?.bio || "",
        links: profile?.links || [],
      });
    }
  }, [open, address, form]);

  function onSubmit(data: ProfileFormValues) {
    setCreatorProfile(address, {
      bio: data.bio,
      links: data.links,
    });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Edit Public Profile</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Public Profile</DialogTitle>
          <DialogDescription>
            Update your bio and add links to show on your public creator page.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bio</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Tell players a bit about yourself..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>Maximum 300 characters.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div>
              <FormLabel>Links</FormLabel>
              <FormDescription className="mb-4">
                Add links to your social media, website, or community.
              </FormDescription>
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex items-start gap-2">
                    <div className="flex-1 space-y-2">
                      <FormField
                        control={form.control}
                        name={`links.${index}.title`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input placeholder="Title (e.g. Twitter, Website)" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`links.${index}.url`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input placeholder="https://..." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(index)}
                      className="text-slate-500 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => append({ title: "", url: "" })}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Link
              </Button>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
